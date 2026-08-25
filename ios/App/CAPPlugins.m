#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(IAPPlugin, "IAP",
           CAP_PLUGIN_METHOD(getProducts, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(purchase, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(restore, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(currentEntitlements, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(manageSubscriptions, CAPPluginReturnPromise);
)
