import Foundation
import Capacitor
import UIKit

/// App Update Manager — cùng interface JS với AppUpdatePlugin.java (plugin name "AppUpdate"):
///   getInfo / checkStore / openStore.
/// checkStore hỏi Apple (iTunes Lookup): chỉ trả phiên bản ĐANG phát hành trên App Store
/// (bản chờ duyệt / TestFlight không xuất hiện ở đây) và cho biết máy này có đủ iOS tối thiểu không.
/// Địa chỉ kho gắn cứng trong app — máy chủ không đổi được.
@objc(AppUpdatePlugin)
public class AppUpdatePlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "AppUpdatePlugin"
    public let jsName = "AppUpdate"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkStore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openStore", returnType: CAPPluginReturnPromise),
    ]

    private let appStoreId = "6776205968"

    @objc func getInfo(_ call: CAPPluginCall) {
        let info = Bundle.main.infoDictionary
        guard let version = info?["CFBundleShortVersionString"] as? String,
              let buildText = info?["CFBundleVersion"] as? String else {
            call.reject("Không đọc được phiên bản đang cài")
            return
        }
        call.resolve(["platform": "ios", "version": version, "build": Int(buildText) ?? 0])
    }

    @objc func checkStore(_ call: CAPPluginCall) {
        // t=… để không nhận bản lưu đệm cũ của CDN/URLSession
        let stamp = Int(Date().timeIntervalSince1970)
        guard let url = URL(string: "https://itunes.apple.com/lookup?id=\(appStoreId)&country=vn&t=\(stamp)") else {
            call.reject("Địa chỉ kiểm tra không hợp lệ")
            return
        }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 8)
        request.httpMethod = "GET"
        URLSession.shared.dataTask(with: request) { data, response, error in
            guard error == nil,
                  (response as? HTTPURLResponse)?.statusCode == 200,
                  let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let first = (json["results"] as? [[String: Any]])?.first,
                  let version = first["version"] as? String else {
                call.reject("App Store chưa trả lời")
                return
            }
            let minimumOs = first["minimumOsVersion"] as? String ?? "0"
            DispatchQueue.main.async {
                let current = UIDevice.current.systemVersion
                let osSupported = current.compare(minimumOs, options: .numeric) != .orderedAscending
                call.resolve(["available": osSupported, "version": version])
            }
        }.resume()
    }

    @objc func openStore(_ call: CAPPluginCall) {
        guard let url = URL(string: "itms-apps://apps.apple.com/app/id\(appStoreId)") else {
            call.reject("Địa chỉ App Store không hợp lệ")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { ok in
                if ok { call.resolve() } else { call.reject("Không mở được App Store") }
            }
        }
    }
}
