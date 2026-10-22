package com.marksixlab.stats.dto;

import com.marksixlab.betting.dto.RecentWin;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

public record LeaderboardEntry(
        @Schema(description = "名次，同分同名次（1、2、2、4）", requiredMode = REQUIRED, example = "1")
        int rank,

        @Schema(description = "暱稱(可能重複)", requiredMode = REQUIRED, example = "小雨")
        String nickname,

        @Schema(description = "期間內的中獎總額", requiredMode = REQUIRED, example = "9640")
        long amount,

        @Schema(description = "是不是目前登入的自己", requiredMode = REQUIRED)
        boolean me,

        @Schema(description = "最近 5 次中獎（已派彩的注單），由新到舊；不分排行榜的期間，沒中過獎是空陣列", requiredMode = REQUIRED)
        List<RecentWin> recentWins
) {

        // 沒有中獎紀錄的寫法
        public LeaderboardEntry(int rank, String nickname, long amount, boolean me) {
                this(rank, nickname, amount, me, List.of());
        }
}
