import Foundation
import Capacitor
import StoreKit

@objc(IAPPlugin)
public class IAPPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "IAPPlugin"
    public let jsName = "IAP"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "currentEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise),
    ]

    private let productIds = [
        "com.vananhaudio.guitar.subscription.khoi_dau",
        "com.vananhaudio.guitar.subscription.can_ban",
        "com.vananhaudio.guitar.monthly",
    ]

    @objc func getProducts(_ call: CAPPluginCall) {
        Task {
            do {
                let products = try await Product.products(for: productIds)
                let sorted = products.sorted { productIds.firstIndex(of: $0.id) ?? 999 < productIds.firstIndex(of: $1.id) ?? 999 }
                call.resolve(["products": sorted.map(productPayload)])
            } catch {
                call.reject("Không tải được gói đăng ký từ App Store.")
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        let requestedId = call.getString("productId") ?? ""
        NSLog("[IAP] purchase_requested product_id=%@", requestedId)
        guard productIds.contains(requestedId) else {
            NSLog("[IAP] purchase_rejected product_id=%@ error=invalid_product_id", requestedId)
            call.reject("Gói đăng ký không hợp lệ.", "invalid_product_id")
            return
        }

        Task { @MainActor in
            do {
                guard let product = try await Product.products(for: [requestedId]).first else {
                    NSLog("[IAP] product_found product_id=%@ found=false", requestedId)
                    call.reject("Không tìm thấy gói đăng ký trên App Store.", "product_not_found")
                    return
                }
                NSLog("[IAP] product_found product_id=%@ found=true", requestedId)

                NSLog("[IAP] purchase_started product_id=%@", requestedId)
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    NSLog("[IAP] purchase_result product_id=%@ state=success", requestedId)
                    let signedTransactionInfo = verification.jwsRepresentation
                    let transaction = try checkVerified(verification)
                    await transaction.finish()
                    call.resolve(transactionPayload(transaction, status: "purchased", signedTransactionInfo: signedTransactionInfo))
                case .userCancelled:
                    NSLog("[IAP] purchase_result product_id=%@ state=userCancelled", requestedId)
                    call.resolve(["productId": requestedId, "status": "cancelled"])
                case .pending:
                    NSLog("[IAP] purchase_result product_id=%@ state=pending", requestedId)
                    call.resolve(["productId": requestedId, "status": "pending"])
                @unknown default:
                    NSLog("[IAP] purchase_result product_id=%@ state=unknown", requestedId)
                    call.reject("Trạng thái mua hàng chưa được hỗ trợ.", "unknown_purchase_state")
                }
            } catch let error as NSError {
                NSLog("[IAP] purchase_error product_id=%@ domain=%@ code=%ld", requestedId, error.domain, error.code)
                call.reject(error.localizedDescription, "\(error.domain):\(error.code)")
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                let entitlements = await currentEntitlementPayloads()
                call.resolve(["status": "restored", "entitlements": entitlements])
            } catch {
                call.reject("Không khôi phục được giao dịch.")
            }
        }
    }

    @objc func currentEntitlements(_ call: CAPPluginCall) {
        Task {
            let entitlements = await currentEntitlementPayloads()
            call.resolve(["entitlements": entitlements])
        }
    }

    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                guard let scene = UIApplication.shared.connectedScenes
                    .compactMap({ $0 as? UIWindowScene })
                    .first(where: { $0.activationState == .foregroundActive }) else {
                    call.reject("Không mở được màn quản lý đăng ký.")
                    return
                }
                try await AppStore.showManageSubscriptions(in: scene)
                call.resolve(["status": "opened"])
            } catch {
                call.reject("Không mở được màn quản lý đăng ký.")
            }
        }
    }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw NSError(domain: "IAPPlugin", code: 1, userInfo: [NSLocalizedDescriptionKey: "Giao dịch chưa được App Store xác minh."])
        case .verified(let safe):
            return safe
        }
    }

    private func currentEntitlementPayloads() async -> [[String: Any]] {
        var payloads: [[String: Any]] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, productIds.contains(transaction.productID) {
                payloads.append(transactionPayload(transaction, status: "restored", signedTransactionInfo: result.jwsRepresentation))
            }
        }
        return payloads
    }

    private func productPayload(_ product: Product) -> [String: Any] {
        var payload: [String: Any] = [
            "productId": product.id,
            "title": product.displayName,
            "description": product.description,
            "price": product.displayPrice,
            "isAvailable": true,
        ]

        if let subscription = product.subscription {
            payload["subscriptionPeriod"] = periodPayload(subscription.subscriptionPeriod)
            payload["subscriptionPeriodValue"] = subscription.subscriptionPeriod.value
            payload["subscriptionPeriodUnit"] = unitName(subscription.subscriptionPeriod.unit)

            if let offer = subscription.introductoryOffer {
                payload["introOfferPaymentMode"] = paymentModeName(offer.paymentMode)
                payload["introOfferPeriod"] = periodPayload(offer.period)
                payload["introOfferPeriodValue"] = offer.period.value
                payload["introOfferPeriodUnit"] = unitName(offer.period.unit)
            }
        }

        return payload
    }

    private func transactionPayload(_ transaction: Transaction, status: String, signedTransactionInfo: String) -> [String: Any] {
        var payload: [String: Any] = [
            "productId": transaction.productID,
            "transactionId": String(transaction.id),
            "originalTransactionId": String(transaction.originalID),
            "signedTransactionInfo": signedTransactionInfo,
            "status": status,
        ]

        if #available(iOS 16.0, *) {
            payload["environment"] = "\(transaction.environment)"
        }

        if let expiresDate = transaction.expirationDate {
            payload["expiresDate"] = isoString(expiresDate)
        }
        if let revocationDate = transaction.revocationDate {
            payload["revocationDate"] = isoString(revocationDate)
        }
        return payload
    }

    private func isoString(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    private func periodPayload(_ period: Product.SubscriptionPeriod) -> String {
        "\(period.value) \(unitName(period.unit))"
    }

    private func unitName(_ unit: Product.SubscriptionPeriod.Unit) -> String {
        switch unit {
        case .day: return "day"
        case .week: return "week"
        case .month: return "month"
        case .year: return "year"
        @unknown default: return "unknown"
        }
    }

    private func paymentModeName(_ mode: Product.SubscriptionOffer.PaymentMode) -> String {
        switch mode {
        case .freeTrial: return "freeTrial"
        case .payAsYouGo: return "payAsYouGo"
        case .payUpFront: return "payUpFront"
        default: return "unknown"
        }
    }
}
