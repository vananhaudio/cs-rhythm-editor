package com.vananhaudio.guitar;

import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import androidx.annotation.NonNull;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

/**
 * Google Play Billing — cùng interface JS với IAPPlugin.swift (plugin name "IAP"):
 *   getProducts / purchase / restore / currentEntitlements / manageSubscriptions.
 * Entitlement KHÔNG cấp ở client — client chỉ đưa purchaseToken lên
 * edge function google-subscription-sync để server verify với Google.
 * KHÔNG log purchaseToken đầy đủ.
 */
@CapacitorPlugin(name = "IAP")
public class IAPPlugin extends Plugin implements PurchasesUpdatedListener {

    private static final String TAG = "IAP";
    // Cùng product id với Apple — dùng chung map tier ở client/server.
    private static final List<String> PRODUCT_IDS = List.of(
        "com.vananhaudio.guitar.subscription.khoi_dau",
        "com.vananhaudio.guitar.subscription.can_ban"
    );

    private BillingClient billingClient;
    private PluginCall pendingPurchaseCall; // call đang chờ PurchasesUpdated

    // ── Kết nối BillingClient (lazy, tự nối lại khi mất) ──
    private interface Ready { void run(BillingClient client); }

    private void withClient(PluginCall call, Ready ready) {
        if (billingClient != null && billingClient.isReady()) {
            ready.run(billingClient);
            return;
        }
        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this)
            // Billing v8: bắt buộc truyền PendingPurchasesParams (bản no-arg đã bị xoá)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build();
        billingClient.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(@NonNull BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    ready.run(billingClient);
                } else {
                    Log.i(TAG, "billing_setup_failed code=" + result.getResponseCode());
                    call.reject("Không kết nối được Google Play Billing.", "billing_unavailable:" + result.getResponseCode());
                }
            }
            @Override public void onBillingServiceDisconnected() {
                Log.i(TAG, "billing_disconnected");
            }
        });
    }

    // ── getProducts ─────────────────────────────────────────────────────────
    @PluginMethod
    public void getProducts(PluginCall call) {
        withClient(call, client -> {
            List<QueryProductDetailsParams.Product> query = new ArrayList<>();
            for (String id : PRODUCT_IDS) {
                query.add(QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build());
            }
            client.queryProductDetailsAsync(
                QueryProductDetailsParams.newBuilder().setProductList(query).build(),
                (result, queryResult) -> {
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        call.reject("Không tải được gói từ Google Play.", "query_failed:" + result.getResponseCode());
                        return;
                    }
                    JSArray products = new JSArray();
                    for (ProductDetails d : queryResult.getProductDetailsList()) {
                        JSObject p = productJson(d);
                        if (p != null) products.put(p);
                    }
                    JSObject out = new JSObject();
                    out.put("products", products);
                    call.resolve(out);
                });
        });
    }

    /** Chọn offer: ưu tiên offer có phase miễn phí (trial); không có thì base plan. */
    private static ProductDetails.SubscriptionOfferDetails pickOffer(ProductDetails d) {
        List<ProductDetails.SubscriptionOfferDetails> offers = d.getSubscriptionOfferDetails();
        if (offers == null || offers.isEmpty()) return null;
        for (ProductDetails.SubscriptionOfferDetails o : offers) {
            for (ProductDetails.PricingPhase ph : o.getPricingPhases().getPricingPhaseList()) {
                if (ph.getPriceAmountMicros() == 0) return o;
            }
        }
        return offers.get(offers.size() - 1); // base plan thường đứng cuối
    }

    private static JSObject productJson(ProductDetails d) {
        ProductDetails.SubscriptionOfferDetails offer = pickOffer(d);
        if (offer == null) return null;
        List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
        ProductDetails.PricingPhase paid = null;
        ProductDetails.PricingPhase free = null;
        for (ProductDetails.PricingPhase ph : phases) {
            if (ph.getPriceAmountMicros() == 0) free = ph;
            else paid = ph; // phase trả phí cuối = giá gói
        }
        if (paid == null) return null;

        JSObject p = new JSObject();
        p.put("productId", d.getProductId());
        p.put("title", d.getTitle());
        p.put("description", d.getDescription());
        p.put("price", paid.getFormattedPrice()); // localized từ Google Play
        String[] period = parseIsoPeriod(paid.getBillingPeriod());
        if (period != null) {
            p.put("subscriptionPeriod", paid.getBillingPeriod());
            p.put("subscriptionPeriodValue", Integer.parseInt(period[0]));
            p.put("subscriptionPeriodUnit", period[1]);
        }
        if (free != null) {
            String[] trial = parseIsoPeriod(free.getBillingPeriod());
            p.put("introOfferPaymentMode", "freeTrial");
            if (trial != null) {
                p.put("introOfferPeriod", free.getBillingPeriod());
                p.put("introOfferPeriodValue", Integer.parseInt(trial[0]));
                p.put("introOfferPeriodUnit", trial[1]);
            }
        }
        p.put("isAvailable", true);
        return p;
    }

    /** ISO 8601 P1M/P7D/P1W/P1Y → [value, unit] với unit khớp bên iOS (day/week/month/year). */
    private static String[] parseIsoPeriod(String iso) {
        if (iso == null || iso.length() < 3 || iso.charAt(0) != 'P') return null;
        String value = iso.substring(1, iso.length() - 1);
        char u = Character.toLowerCase(iso.charAt(iso.length() - 1));
        String unit = u == 'd' ? "day" : u == 'w' ? "week" : u == 'm' ? "month" : u == 'y' ? "year" : null;
        if (unit == null) return null;
        try { Integer.parseInt(value); } catch (NumberFormatException e) { return null; }
        return new String[]{ value, unit };
    }

    // ── purchase ────────────────────────────────────────────────────────────
    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId", "");
        Log.i(TAG, "purchase_requested product_id=" + productId);
        if (!PRODUCT_IDS.contains(productId)) {
            call.reject("Gói đăng ký không hợp lệ.", "invalid_product_id");
            return;
        }
        withClient(call, client -> client.queryProductDetailsAsync(
            QueryProductDetailsParams.newBuilder().setProductList(List.of(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(productId)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build())).build(),
            (result, queryResult) -> {
                List<ProductDetails> found = queryResult == null ? List.of() : queryResult.getProductDetailsList();
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || found.isEmpty()) {
                    call.reject("Không tìm thấy gói đăng ký trên Google Play.", "product_not_found");
                    return;
                }
                ProductDetails d = found.get(0);
                ProductDetails.SubscriptionOfferDetails offer = pickOffer(d);
                if (offer == null) {
                    call.reject("Gói chưa có base plan trên Google Play.", "offer_not_found");
                    return;
                }
                BillingFlowParams params = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(List.of(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(d)
                            .setOfferToken(offer.getOfferToken())
                            .build()))
                    .build();
                pendingPurchaseCall = call;
                call.setKeepAlive(true);
                BillingResult launch = getActivity() == null
                    ? null
                    : client.launchBillingFlow(getActivity(), params);
                if (launch == null || launch.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    pendingPurchaseCall = null;
                    call.setKeepAlive(false);
                    call.reject("Không mở được màn thanh toán Google Play.",
                        "launch_failed:" + (launch == null ? "no_activity" : launch.getResponseCode()));
                }
            }));
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult result, List<Purchase> purchases) {
        PluginCall call = pendingPurchaseCall;
        pendingPurchaseCall = null;
        if (call == null) return;
        call.setKeepAlive(false);

        int code = result.getResponseCode();
        Log.i(TAG, "purchase_result code=" + code);
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            JSObject out = new JSObject();
            out.put("status", "cancelled");
            call.resolve(out);
            return;
        }
        if (code != BillingClient.BillingResponseCode.OK || purchases == null || purchases.isEmpty()) {
            call.reject("Giao dịch Google Play không hoàn tất.", "purchase_failed:" + code);
            return;
        }
        Purchase purchase = purchases.get(0);
        acknowledgeIfNeeded(purchase);
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            JSObject out = new JSObject();
            out.put("status", "pending");
            call.resolve(out);
            return;
        }
        call.resolve(purchaseJson(purchase, "purchased"));
    }

    /** Google yêu cầu acknowledge trong 3 ngày — ack ngay; entitlement vẫn do server verify quyết định. */
    private void acknowledgeIfNeeded(Purchase purchase) {
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED || purchase.isAcknowledged()) return;
        billingClient.acknowledgePurchase(
            AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build(),
            r -> Log.i(TAG, "acknowledge code=" + r.getResponseCode()));
    }

    private static JSObject purchaseJson(Purchase purchase, String status) {
        JSObject out = new JSObject();
        String productId = purchase.getProducts().isEmpty() ? "" : purchase.getProducts().get(0);
        out.put("productId", productId);
        out.put("status", status);
        out.put("transactionId", purchase.getOrderId());
        out.put("purchaseToken", purchase.getPurchaseToken());
        return out;
    }

    // ── restore / currentEntitlements ───────────────────────────────────────
    @PluginMethod
    public void restore(PluginCall call) {
        queryActive(call, true);
    }

    @PluginMethod
    public void currentEntitlements(PluginCall call) {
        queryActive(call, false);
    }

    private void queryActive(PluginCall call, boolean asRestore) {
        withClient(call, client -> client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
            (result, purchases) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    call.reject("Không đọc được giao dịch Google Play.", "query_purchases_failed:" + result.getResponseCode());
                    return;
                }
                JSArray items = new JSArray();
                for (Purchase p : purchases) {
                    if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
                    acknowledgeIfNeeded(p);
                    items.put(purchaseJson(p, "restored"));
                }
                JSObject out = new JSObject();
                if (asRestore) out.put("status", "done");
                out.put("entitlements", items);
                call.resolve(out);
            }));
    }

    // ── manageSubscriptions ─────────────────────────────────────────────────
    @PluginMethod
    public void manageSubscriptions(PluginCall call) {
        try {
            Uri uri = Uri.parse("https://play.google.com/store/account/subscriptions?package=" + getContext().getPackageName());
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Không mở được trang quản lý đăng ký Google Play.", "manage_failed");
        }
    }
}
