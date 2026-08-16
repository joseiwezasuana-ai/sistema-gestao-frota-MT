export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

type ConfirmResolver = (value: boolean) => void;

export interface CustomConfirmEventDetail extends ConfirmOptions {
  resolve: ConfirmResolver;
}

export function customConfirm(
  messageOrOptions: string | ConfirmOptions,
  title?: string
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const options: ConfirmOptions =
      typeof messageOrOptions === 'string'
        ? { message: messageOrOptions, title: title || 'Confirmar Ação' }
        : messageOrOptions;

    const detail: CustomConfirmEventDetail = {
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      isDanger: options.isDanger ?? true,
      title: options.title || 'Confirmar Ação',
      message: options.message,
      resolve,
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('super_taxi_show_custom_confirm', { detail })
      );
    } else {
      resolve(true);
    }
  });
}

// Override global window.confirm safely so legacy or async calls don't trigger native iframe sandbox warnings
if (typeof window !== 'undefined') {
  (window as any).customConfirm = customConfirm;
}
