#!/usr/bin/env bash
# Build bản phát hành TVA Guitar. Chạy ở gốc repo trên máy có khoá ký.
#   bash scripts/mobile-release.sh android     → AAB đã ký
#   bash scripts/mobile-release.sh ios         → .xcarchive (máy có Xcode)
#   bash scripts/mobile-release.sh both
# Dừng ngay nếu: cây mã bẩn · còn cờ bản thử · thiếu khoá ký · bundle lọt mã thử nghiệm.
set -euo pipefail
cd "$(dirname "$0")/.."
what="${1:-}"; case "$what" in ios|android|both) ;; *) echo "dùng: $0 ios|android|both"; exit 2;; esac
die() { echo "DỪNG: $*" >&2; exit 1; }

[[ -z "$(git status --porcelain)" ]] || die "cây mã còn thay đổi chưa commit"
[[ -z "${VITE_APP_UPDATE_QA:-}" ]] || die "đang đặt VITE_APP_UPDATE_QA (cờ bản thử)"
! grep -sq '^VITE_APP_UPDATE_QA=' .env .env.local .env.native .env.native.local .env.production .env.production.local || die "tệp .env còn cờ bản thử"
if [[ $what != ios ]]; then
  [[ -f android/keystore.properties ]] || die "thiếu android/keystore.properties"
  ks="$(sed -n 's/^storeFile=//p' android/keystore.properties)"
  ( cd android/app && [[ -f "$ks" ]] ) || die "không thấy tệp khoá ký: $ks"
fi
if [[ $what != android ]]; then
  xcodebuild -version >/dev/null 2>&1 || die "máy này không có Xcode"
fi

npm ci --no-audit --no-fund
npm run test:app-update
npm run build:native
! grep -rq "TVA-QA" dist || die "bundle chứa mã bản thử"
commit="$(git rev-parse --short HEAD)"

if [[ $what != ios ]]; then
  npx cap sync android
  ( cd android && ./gradlew bundleRelease )
  aab=android/app/build/outputs/bundle/release/app-release.aab
  jarsigner -verify "$aab" | grep -q "jar verified" || die "AAB chưa được ký"
  echo "ANDROID OK ($commit): $aab"; shasum -a 256 "$aab"
fi
if [[ $what != android ]]; then
  npx cap sync ios
  out="build/App-1.7.0-$commit.xcarchive"
  xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release \
    -destination 'generic/platform=iOS' -archivePath "$out" archive -allowProvisioningUpdates
  /usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleShortVersionString' -c 'Print :ApplicationProperties:CFBundleVersion' "$out/Info.plist"
  echo "iOS OK ($commit): $out"
fi
git checkout -q -- android/capacitor.settings.gradle 2>/dev/null || true
