import { OverlayToaster, ToastProps, Toaster } from "@blueprintjs/core"

let toaster: Toaster

export function showToast(options: ToastProps) {
    if (!toaster) {
        toaster = OverlayToaster.create()
    }

    return toaster.show(options)
}
