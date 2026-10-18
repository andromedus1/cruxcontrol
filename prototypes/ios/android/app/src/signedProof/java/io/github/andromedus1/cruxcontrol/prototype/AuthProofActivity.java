package io.github.andromedus1.cruxcontrol.prototype;

import android.os.Bundle;

/** Explicit emulator entry point, absent from the distribution variant. */
public class AuthProofActivity extends MainActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeAuthProofPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
