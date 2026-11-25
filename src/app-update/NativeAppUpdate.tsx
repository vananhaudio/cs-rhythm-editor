import AppUpdateGate from './AppUpdateGate'
import './appUpdate.css'
import { nativeUpdateDeps, openStore } from './native'

export default function NativeAppUpdate() {
  return <AppUpdateGate deps={nativeUpdateDeps} openStore={openStore} />
}
