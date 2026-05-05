package com.dummy.tmp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {

        // 🔥 Apply BEFORE anything else
        getWindow().setDecorFitsSystemWindows(true);

        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();

        // Force a fresh system UI sync AFTER first attach
        getWindow().getDecorView().requestApplyInsets();
    }
}
