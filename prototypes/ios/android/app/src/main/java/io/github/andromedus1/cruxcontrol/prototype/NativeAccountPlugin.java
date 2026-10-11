package io.github.andromedus1.cruxcontrol.prototype;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Narrow account identity surface; Firebase credentials and tokens stay native. */
@CapacitorPlugin(name = "NativeAccount")
public final class NativeAccountPlugin extends Plugin {
    private NativeAccountSession session;

    @Override
    public void load() {
        session = NativeAccountSession.get(getContext());
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject result = session.accountStatus();
        call.resolve(result);
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        session.signIn(call, getActivity(), false);
    }

    @PluginMethod
    public void verifySession(PluginCall call) {
        session.verifySession(call);
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        session.signOut(call, false);
    }
}
