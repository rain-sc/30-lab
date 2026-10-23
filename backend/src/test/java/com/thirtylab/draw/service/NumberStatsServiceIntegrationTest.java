package com.thirtylab.draw.service;

import com.thirtylab.draw.dto.NumberStat;
import com.thirtylab.draw.dto.NumberStatsResponse;
import com.thirtylab.draw.model.Draw;
import com.thirtylab.draw.model.DrawStatus;
import com.thirtylab.draw.repository.DrawRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class NumberStatsServiceIntegrationTest {

    @Autowired
    private NumberStatsService numberStatsService;

    @Autowired
    private DrawRepository drawRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void setUp() {
        mongoTemplate.remove(new Query(), Draw.class);
        // 由舊到新：0001、0002、0003；0004 還沒開獎，不能算進去
        saveDraw("20261020-0001", DrawStatus.SETTLED, List.of(1, 2, 3, 4, 5, 6), 7);
        saveDraw("20261020-0002", DrawStatus.SETTLED, List.of(1, 2, 3, 10, 11, 12), 4);
        saveDraw("20261020-0003", DrawStatus.DRAWN, List.of(1, 20, 21, 22, 23, 24), 2);
        saveDraw("20261020-0004", DrawStatus.OPEN, null, null);
    }

    @Test
    void countsMainAndSpecialNumbersAndMissedDraws() {
        NumberStatsResponse stats = numberStatsService.numberStats(100);

        assertThat(stats.window()).isEqualTo(3);
        assertThat(stats.numbers()).hasSize(49);
        assertThat(stat(stats, 1)).isEqualTo(new NumberStat(1, 3, 0, 0));
        assertThat(stat(stats, 2)).isEqualTo(new NumberStat(2, 2, 1, 0));
        assertThat(stat(stats, 4)).isEqualTo(new NumberStat(4, 1, 1, 1));
        assertThat(stat(stats, 7)).isEqualTo(new NumberStat(7, 0, 1, 2));
        assertThat(stat(stats, 49)).isEqualTo(new NumberStat(49, 0, 0, 3));
    }

    @Test
    void windowOnlyCountsTheLatestDraws() {
        NumberStatsResponse stats = numberStatsService.numberStats(2);

        assertThat(stats.window()).isEqualTo(2);
        assertThat(stat(stats, 1)).isEqualTo(new NumberStat(1, 2, 0, 0));
        assertThat(stat(stats, 5)).isEqualTo(new NumberStat(5, 0, 0, 2));
        assertThat(stat(stats, 7)).isEqualTo(new NumberStat(7, 0, 0, 2));
    }

    private static NumberStat stat(NumberStatsResponse stats, int number) {
        return stats.numbers().get(number - 1);
    }

    private void saveDraw(String drawNo, DrawStatus status, List<Integer> numbers, Integer special) {
        int seq = Integer.parseInt(drawNo.substring(9));
        Instant drawAt = Instant.parse("2026-10-20T00:00:00Z").plusSeconds(300L * seq);
        Draw draw = new Draw();
        draw.setDrawNo(drawNo);
        draw.setStatus(status);
        draw.setOpenAt(drawAt.minusSeconds(300));
        draw.setCloseAt(drawAt.minusSeconds(15));
        draw.setDrawAt(drawAt);
        draw.setNumbers(numbers);
        draw.setSpecialNumber(special);
        drawRepository.save(draw);
    }
}
