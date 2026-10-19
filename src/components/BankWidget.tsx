import { useEffect, useRef } from "react";
import type { PluggyConnect as SDKInstance } from "pluggy-connect-sdk";
type Props = {
  session: {
    connectToken: string;
    connectorIds: number[];
    updateItem?: string;
  };
  onSuccess: (itemId: string) => void;
  onClose: () => void;
  onError: (error: unknown) => void;
};
/** Explicit lifecycle also handles React StrictMode's mount/cleanup rehearsal. */
export default function BankWidget(props: Props) {
  const container = useRef<HTMLDivElement>(null),
    callbacks = useRef(props);
  callbacks.current = props;
  useEffect(() => {
    let cancelled = false;
    let instance: SDKInstance | undefined;
    void import("pluggy-connect-sdk")
      .then(({ PluggyConnect }) => {
        if (cancelled || !container.current) return;
        instance = new PluggyConnect({
          ...props.session,
          includeSandbox: false,
          connectorTypes: ["PERSONAL_BANK"],
          countries: ["BR"],
          products: ["ACCOUNTS"],
          language: "pt",
          allowConnectInBackground: false,
          onSuccess: ({ item }) => {
            if (!cancelled) callbacks.current.onSuccess(item.id);
          },
          onClose: () => {
            if (!cancelled) callbacks.current.onClose();
          },
          onError: (error) => {
            if (!cancelled) callbacks.current.onError(error);
          },
        });
        return instance.init(container.current);
      })
      .catch(() => {
        if (!cancelled)
          callbacks.current.onError({ code: "WIDGET_LOAD_FAILED" });
      });
    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [props.session]);
  return (
    <div ref={container} aria-label="Autorização Open Finance no Pluggy" />
  );
}
