package com.vananhaudio.guitar;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.model.UpdateAvailability;

/**
 * App Update Manager — cùng interface JS với AppUpdatePlugin.swift (plugin name "AppUpdate"):
 *   getInfo / checkStore / openStore.
 * checkStore hỏi chính Google Play (In-App Updates API): chỉ báo "có" khi Play thật sự phát bản mới
 * cho THIẾT BỊ + TÀI KHOẢN này (đã duyệt, đã tới lượt trong phát hành từng phần).
 * Địa chỉ kho gắn cứng trong app — máy chủ không đổi được.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    @PluginMethod
    public void getInfo(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
            JSObject out = new JSObject();
            out.put("platform", "android");
            out.put("version", info.versionName);
            out.put("build", code);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Không đọc được phiên bản đang cài", e);
        }
    }

    @PluginMethod
    public void checkStore(PluginCall call) {
        try {
            AppUpdateManagerFactory.create(getContext()).getAppUpdateInfo()
                .addOnSuccessListener(info -> {
                    boolean available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE;
                    JSObject out = new JSObject();
                    out.put("available", available);
                    if (available) out.put("build", info.availableVersionCode());
                    call.resolve(out);
                })
                // Bản cài ngoài Play, máy không có dịch vụ Play, mất mạng… → lỗi, phía JS im lặng bỏ qua
                .addOnFailureListener(e -> call.reject("Google Play chưa trả lời", e));
        } catch (Exception e) {
            call.reject("Không hỏi được Google Play", e);
        }
    }

    @PluginMethod
    public void openStore(PluginCall call) {
        String id = getContext().getPackageName();
        try {
            Intent market = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + id));
            market.setPackage("com.android.vending");
            market.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(market);
            call.resolve();
        } catch (ActivityNotFoundException noPlayApp) {
            try {
                Intent web = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + id));
                web.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(web);
                call.resolve();
            } catch (Exception e) {
                call.reject("Không mở được Google Play", e);
            }
        }
    }
}
