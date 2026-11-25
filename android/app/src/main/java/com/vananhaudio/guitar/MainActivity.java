package com.vananhaudio.guitar;

import android.os.Bundle;

import androidx.appcompat.app.AppCompatDelegate;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App chỉ có giao diện sáng, kể cả hộp thoại AppCompat — không theo chế độ tối của máy
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
        registerPlugin(IAPPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
