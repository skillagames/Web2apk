package com.dummy.tmp;

import android.os.Bundle;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Disable edge-to-edge
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}
