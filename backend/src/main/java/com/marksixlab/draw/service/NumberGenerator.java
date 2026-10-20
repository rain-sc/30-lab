package com.marksixlab.draw.service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.springframework.stereotype.Component;

@Component
public class NumberGenerator {

    private static final int MAX_NUMBER = 49;

    private final SecureRandom random = new SecureRandom();

    public DrawnNumbers draw() {
        List<Integer> pool = new ArrayList<>(MAX_NUMBER);
        for (int n = 1; n <= MAX_NUMBER; n++) {
            pool.add(n);
        }
        Collections.shuffle(pool, random);
        return new DrawnNumbers(List.copyOf(pool.subList(0, 6)), pool.get(6));
    }
}
