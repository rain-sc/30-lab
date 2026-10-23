package com.thirtylab.rules.service;

public final class Combinations {

    private Combinations() {
    }

    // 從 n 個裡面選 k 個有幾種選法：C(n, k)
    public static long choose(int n, int k) {
        if (k < 0 || k > n) {
            return 0;
        }
        long result = 1;
        for (int i = 0; i < k; i++) {
            // 每一步都先乘再除，結果一定是整數，也不會像先算 49! 那樣溢位
            result = result * (n - i) / (i + 1);
        }
        return result;
    }
}
