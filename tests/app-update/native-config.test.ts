// Chốt chặn cấu hình native: không để chế độ tối quay lại, plugin AppUpdate được đăng ký ở cả hai nền tảng.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
const read = (p: string) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')

test('iOS khoá giao diện sáng', () => {
  assert.match(read('ios/App/App/Info.plist'), /<key>UIUserInterfaceStyle<\/key>\s*<string>Light<\/string>/)
  assert.doesNotMatch(read('ios/App/App/Base.lproj/LaunchScreen.storyboard'), /systemColor=/)
  assert.doesNotMatch(read('ios/App/App/Assets.xcassets/Splash.imageset/Contents.json'), /luminosity|appearances/)
})
test('Android: theme sáng, không thư mục *-night, không cho ép tối', () => {
  const styles = read('android/app/src/main/res/values/styles.xml').replace(/<!--[\s\S]*?-->/g, '')
  assert.doesNotMatch(styles, /DayNight|DeviceDefault|Theme\.AppCompat\.NoActionBar/)
  assert.match(styles, /name="AppTheme\.NoActionBar" parent="Theme\.AppCompat\.Light\.NoActionBar"/)
  assert.match(styles, /windowSplashScreenBackground">@android:color\/white/)
  assert.deepEqual(readdirSync(new URL('../../android/app/src/main/res', import.meta.url)).filter(d => d.includes('night')), [])
  assert.match(read('android/app/src/main/java/com/vananhaudio/guitar/MainActivity.java'), /MODE_NIGHT_NO/)
})
test('thanh trạng thái: chữ tối trên nền sáng, không theo máy', () => {
  assert.equal(JSON.parse(read('capacitor.config.json')).plugins.SystemBars.style, 'LIGHT')
})
test('plugin AppUpdate đăng ký ở cả hai nền tảng, link kho gắn cứng', () => {
  assert.match(read('android/app/src/main/java/com/vananhaudio/guitar/MainActivity.java'), /registerPlugin\(AppUpdatePlugin\.class\)/)
  assert.match(read('ios/App/ViewController.swift'), /registerPluginInstance\(AppUpdatePlugin\(\)\)/)
  assert.match(read('ios/App/App.xcodeproj/project.pbxproj'), /AppUpdatePlugin\.swift in Sources \*\/,/)
  assert.match(read('ios/App/AppUpdatePlugin.swift'), /appStoreId = "6776205968"/)
})
test('cờ bản thử: bản phát hành bị chặn nếu còn cờ hoặc bundle lọt mã thử', () => {
  assert.match(read('src/app-update/native.ts'), /TVA-QA/)
  const release = read('scripts/mobile-release.sh')
  assert.match(release, /-z "\$\{VITE_APP_UPDATE_QA:-\}"/)
  assert.match(release, /! grep -rq "TVA-QA" dist/)
  assert.doesNotMatch(read('netlify.toml'), /VITE_APP_UPDATE_QA/)
})
