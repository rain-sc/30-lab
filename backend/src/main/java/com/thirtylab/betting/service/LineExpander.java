package com.thirtylab.betting.service;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.stream.Stream;

// 把複式、膽拖的選號展開成一注一注的 6 個號碼
final class LineExpander {

    static final int PICK_COUNT = 6;

    private LineExpander() {
    }

    // 複式：從 numbers 裡選 6 個的所有組合，每一注由小到大、整體依字典順序
    static List<List<Integer>> multiple(List<Integer> numbers) {
        List<Integer> sorted = numbers.stream().sorted().toList();
        List<List<Integer>> lines = new ArrayList<>();
        collect(sorted, PICK_COUNT, 0, new ArrayList<>(), combo -> lines.add(List.copyOf(combo)));
        return lines;
    }

    // 膽拖：每一注 = 全部的膽 + 從拖裡選 (6 - 膽數) 個，每一注由小到大
    static List<List<Integer>> banker(List<Integer> bankers, List<Integer> legs) {
        List<Integer> sortedLegs = legs.stream().sorted().toList();
        List<List<Integer>> lines = new ArrayList<>();
        collect(sortedLegs, PICK_COUNT - bankers.size(), 0, new ArrayList<>(),
                combo -> lines.add(Stream.concat(bankers.stream(), combo.stream()).sorted().toList()));
        return lines;
    }

    // 膽拖會展開成幾注：C(拖數, 6 - 膽數)。先算數量，太多就不用真的展開
    static long bankerLineCount(int bankers, int legs) {
        return choose(legs, PICK_COUNT - bankers);
    }

    private static long choose(int n, int k) {
        if (k < 0 || k > n) {
            return 0;
        }
        long result = 1;
        for (int i = 1; i <= k; i++) {
            result = result * (n - k + i) / i;       // 每一步都整除，不會有小數
        }
        return result;
    }

    private static void collect(List<Integer> pool, int k, int start, List<Integer> current,
                                Consumer<List<Integer>> out) {
        if (current.size() == k) {
            out.accept(current);
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
