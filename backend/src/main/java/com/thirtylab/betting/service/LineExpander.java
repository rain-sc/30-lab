package com.thirtylab.betting.service;

import java.util.ArrayList;
import java.util.List;

// 把複式的選號展開成一注一注的 6 個號碼
final class LineExpander {

    static final int PICK_COUNT = 6;

    private LineExpander() {
    }

    // 複式：從 numbers 裡選 6 個的所有組合，每一注由小到大、整體依字典順序
    static List<List<Integer>> multiple(List<Integer> numbers) {
        List<Integer> sorted = numbers.stream().sorted().toList();
        List<List<Integer>> lines = new ArrayList<>();
        collect(sorted, PICK_COUNT, 0, new ArrayList<>(), lines);
        return lines;
    }

    private static void collect(List<Integer> pool, int k, int start, List<Integer> current, List<List<Integer>> out) {
        if (current.size() == k) {
            out.add(List.copyOf(current));
            return;
        }
        // 剩下的號碼不夠湊滿 k 個就不用再往下找
        for (int i = start; i <= pool.size() - (k - current.size()); i++) {
            current.add(pool.get(i));
            collect(pool, k, i + 1, current, out);
            current.removeLast();
        }
    }
}
