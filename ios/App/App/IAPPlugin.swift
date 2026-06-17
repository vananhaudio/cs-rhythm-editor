import Foundation
import Capacitor
import StoreKit

@objc(IAPPlugin)
public class IAPPlugin: CAPPlugin, CAPBridgedPlugin, SKProductsRequestDelegate, SKPaymentTransactionObserver {

    public let identifier = "IAPPlugin"
    public let jsName = "IAP"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
    ]

    private let PRODUCT_ID = "com.vananhaudio.guitar.monthly"
    private var products: [SKProduct] = []
    private var pendingCall: CAPPluginCall?

    override public func load() {
        SKPaymentQueue.default().add(self)
        fetchProducts()
    }

    private func fetchProducts() {
        let request = SKProductsRequest(productIdentifiers: [PRODUCT_ID])
        request.delegate = self
        request.start()
    }

    // MARK: - Plugin Methods

    @objc func getProducts(_ call: CAPPluginCall) {
        if products.isEmpty {
            fetchProducts()
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                self?.returnProducts(call)
            }
        } else {
            returnProducts(call)
        }
    }

    private func returnProducts(_ call: CAPPluginCall) {
        let list = products.map { p -> [String: Any] in
            let formatter = NumberFormatter()
            formatter.numberStyle = .currency
            formatter.locale = p.priceLocale
            let price = formatter.string(from: p.price) ?? "\(p.price)"
            return [
                "productId": p.productIdentifier,
                "title": p.localizedTitle,
                "description": p.localizedDescription,
                "price": price,
            ]
        }
        call.resolve(["products": list])
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard SKPaymentQueue.canMakePayments() else {
            call.reject("Purchases are disabled on this device")
            return
        }
        guard let product = products.first(where: { $0.productIdentifier == PRODUCT_ID })
              ?? products.first else {
            pendingCall = call
            fetchProducts()
            // Timeout 10 giây nếu không tìm được sản phẩm
            DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) { [weak self] in
                guard let self = self, let pending = self.pendingCall else { return }
                self.pendingCall = nil
                pending.reject("Không tìm thấy sản phẩm. Kiểm tra kết nối mạng và thử lại.")
            }
            return
        }
        pendingCall = call
        let payment = SKPayment(product: product)
        SKPaymentQueue.default().add(payment)
    }

    @objc func restore(_ call: CAPPluginCall) {
        pendingCall = call
        SKPaymentQueue.default().restoreCompletedTransactions()
    }

    // MARK: - SKProductsRequestDelegate

    public func productsRequest(_ request: SKProductsRequest, didReceive response: SKProductsResponse) {
        products = response.products
        // Nếu đang chờ purchase thì tiếp tục
        if let call = pendingCall, !products.isEmpty {
            pendingCall = nil
            purchase(call)
        }
    }

    // MARK: - SKPaymentTransactionObserver

    public func paymentQueue(_ queue: SKPaymentQueue, updatedTransactions transactions: [SKPaymentTransaction]) {
        for transaction in transactions {
            switch transaction.transactionState {
            case .purchased, .restored:
                SKPaymentQueue.default().finishTransaction(transaction)
                if let call = pendingCall {
                    pendingCall = nil
                    call.resolve(["productId": transaction.payment.productIdentifier, "status": "purchased"])
                }
                notifyListeners("purchaseCompleted", data: ["productId": transaction.payment.productIdentifier])
            case .failed:
                SKPaymentQueue.default().finishTransaction(transaction)
                if let call = pendingCall {
                    pendingCall = nil
                    let msg = transaction.error?.localizedDescription ?? "Purchase failed"
                    call.reject(msg)
                }
            default:
                break
            }
        }
    }

    public func paymentQueueRestoreCompletedTransactionsFinished(_ queue: SKPaymentQueue) {
        if let call = pendingCall {
            pendingCall = nil
            call.resolve(["status": "restored"])
        }
    }
}
