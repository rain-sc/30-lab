package com.marksixlab.draw.service;

import com.marksixlab.config.GameProperties;
import com.marksixlab.draw.dto.NumberStat;
import com.marksixlab.draw.dto.NumberStatsResponse;
import com.marksixlab.draw.model.Draw;
import com.marksixlab.draw.model.DrawStatus;
import com.marksixlab.draw.repository.DrawRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class NumberStatsService {

    public static final int DEFAULT_WINDOW = 100;
    public static final int MAX_WINDOW = 500;
    private final GameProperties gameProperties;
    private static final List<DrawStatus> DRAWN_STATUSES = List.of(DrawStatus.DRAWN,DrawStatus.SETTLED);
    private final DrawRepository drawRepository;
    private final MongoTemplate mongoTemplate;

    record BallCount(@Id int number, int count, int specialCount, int lastAge){}

    public NumberStatsResponse numberStats(int window){
        int size = Math.min(Math.max(window, 1), MAX_WINDOW);
        int counted = (int) Math.min(size, drawRepository.countByStatusIn(DRAWN_STATUSES));

        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("status").in(DRAWN_STATUSES)),
                Aggregation.sort(Sort.Direction.DESC,"drawAt"),
                Aggregation.limit(size),
                Aggregation.stage("""
                        { $setWindowFields: { sortBy: { drawAt: -1 }, output: { age: { $documentNumber: {} } } } }
                        """),
                Aggregation.stage("""
                        { $project: { age: 1, balls: { $concatArrays: [
                            { $map: { input: "$numbers", as: "n", in: { number: "$$n", special: false } } },
                            [ { number: "$specialNumber", special: true } ]
                        ] } } }
                        """),
                Aggregation.stage("""
                        { $unwind: "$balls" }
                        """),
                Aggregation.stage("""
                        { $group: {
                            _id: "$balls.number",
                            count: { $sum: { $cond: ["$balls.special", 0, 1] } },
                            specialCount: { $sum: { $cond: ["$balls.special", 1, 0] } },
                            lastAge: { $min: "$age" }
                        } }
                        """));

        Map<Integer, BallCount> byNumber = mongoTemplate.aggregate(aggregation, Draw.class, BallCount.class)
                .getMappedResults()
                .stream()
                .collect(Collectors.toMap(BallCount::number, Function.identity()));

        List<NumberStat> numbers = IntStream.rangeClosed(1, gameProperties.maxNumber())
                .mapToObj(n ->{
                    BallCount ball = byNumber.get(n);
                    if(ball == null){
                        return new NumberStat(n, 0, 0, counted);
                    }
                    return new NumberStat(n, ball.count(), ball.specialCount(), ball.lastAge() -1);
                }).toList();

        return new NumberStatsResponse(counted,numbers);
    }
}
