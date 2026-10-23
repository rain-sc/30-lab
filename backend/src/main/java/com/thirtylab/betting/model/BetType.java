package com.thirtylab.betting.model;

public enum BetType {
    // 單式：每一注自己選 6 個號碼
    SINGLE,
    // 複式：選 7 個以上的號碼，展開成所有 6 個號碼的組合
    MULTIPLE,
    // 膽拖：膽（1~5 個）每一注都有，再從拖裡選剩下的號碼湊滿 6 個
    BANKER
}
