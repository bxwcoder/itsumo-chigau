package com.bxwcoder.itsumochigau;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 自作の部品（カレンダーへの書き込み）を登録する
        registerPlugin(CalendarPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
