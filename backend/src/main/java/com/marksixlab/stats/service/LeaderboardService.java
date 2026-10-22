package com.marksixlab.stats.service;

import com.marksixlab.account.service.UserService;
import com.marksixlab.stats.dto.BalanceLeaderboardResponse;
import com.marksixlab.stats.dto.LeaderboardEntry;
import com.marksixlab.stats.dto.LeaderboardPeriod;
import com.marksixlab.stats.dto.LeaderboardResponse;
import com.marksixlab.wallet.dto.UserRank;
import com.marksixlab.wallet.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class LeaderboardService {

    private static final int TOP = 20;

    private final WalletService walletService;
    private final UserService userService;

    private record Board(List<LeaderboardEntry> entries, LeaderboardEntry mine) {
    }

    public LeaderboardResponse leaderboard(LeaderboardPeriod period,String userId, Instant now){
        LocalDate firstDay = period.firstDay(now);
        Instant from = firstDay.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = firstDay.plusDays(period.days()).atStartOfDay(ZoneOffset.UTC).toInstant();

        Board board = board(walletService.payoutRanking(from, to), userId);
        return new LeaderboardResponse(period, from, to, board.entries(), board.mine());
    }

    public BalanceLeaderboardResponse balanceLeaderboard(String userId) {
        Board board = board(walletService.balanceRanking(), userId);
        return new BalanceLeaderboardResponse(board.entries(), board.mine());
    }

    // 完整名次表 → 前 20 名 + 自己的名次，再一次查出需要的暱稱
    private Board board(List<UserRank> ranking, String userId) {
        List<UserRank> top = ranking.stream().limit(TOP).toList();
        UserRank mine = ranking.stream()
                .filter(row -> row.userId().equals(userId))
                .findFirst()
                .orElse(null);

        Set<String> userIds = new HashSet<>();
        top.forEach(row -> userIds.add(row.userId()));
        if(mine != null){
            userIds.add(mine.userId());
        }
        Map<String,String> nicknames = userService.nicknames(userIds);

        List<LeaderboardEntry> entries = top.stream()
                .map(row -> toEntry(row, nicknames, userId))
                .toList();
        LeaderboardEntry mineEntry = mine == null ? null : toEntry(mine,nicknames, userId);
        return new Board(entries, mineEntry);
    }

    private static LeaderboardEntry toEntry(UserRank row, Map<String,String> nicknames,String userId ){
        return new LeaderboardEntry(row.rank(),nicknames.get(row.userId()),row.amount(),row.userId().equals(userId));
    }
}
