package io.github.andromedus1.cruxcontrol.prototype;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(LibraryBackupFilePlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge != null) bridge.setWebViewClient(new CatalogAssetWebViewClient(bridge));
    }
}
