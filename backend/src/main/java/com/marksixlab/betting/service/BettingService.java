package com.marksixlab.betting.service;

import com.marksixlab.betting.dto.PlaceBetRequest;
import com.marksixlab.betting.dto.PlaceBetResponse;
import com.marksixlab.betting.dto.RecentWin;
import com.marksixlab.betting.dto.TicketResponse;
import com.marksixlab.betting.model.*;
import com.marksixlab.betting.repository.TicketRepository;
import com.marksixlab.common.BusinessException;
import com.marksixlab.common.ErrorCode;
import com.marksixlab.common.PageResult;
import com.marksixlab.common.Pagination;
import com.marksixlab.config.BettingProperties;
import com.marksixlab.config.GameProperties;
import com.marksixlab.draw.service.DrawService;
import com.marksixlab.wallet.model.WalletTransactionType;
import com.marksixlab.wallet.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.annotation.Id;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.Comparator;

@Service
@RequiredArgsConstructor
public class BettingService {

    private static final int MAX_ATTEMPTS = 3;

    private final TicketRepository ticketRepository;
    private final DrawService drawService;
    private final WalletService walletService;
    private final TransactionTemplate transactionTemplate;
    private final BettingProperties bettingProperties;
    private final GameProperties gameProperties;
    private final MongoTemplate mongoTemplate;

    public PlaceBetResponse place(String userId, PlaceBetRequest req, Instant now) {
        for (int attempt = 1; ; attempt++) {
            try {
                return tryPlace(userId, req, now);
            } catch (DataIntegrityViolationException e) {
                if (attempt == MAX_ATTEMPTS) {
                    throw e;
                }
                pause(attempt);
            }
        }
    }

    private PlaceBetResponse tryPlace(String userId, PlaceBetRequest req, Instant now) {
        var existing = ticketRepository.findByUserIdAndIdempotencyKey(userId, req.idempotencyKey());
        if (existing.isPresent()) {
            return withBalance(existing.get(), userId);
        }

        if (req.lines().size() > bettingProperties.maxLines()) {
            throw new BusinessException(ErrorCode.TOO_MANY_LINES);
        }
        drawService.requireOpenForBetting(req.drawNo(), now);
        walletService.getOrOpen(userId);

        Ticket ticket = new Ticket();
        ticket.setUserId(userId);
        ticket.setDrawNo(req.drawNo());
        ticket.setBetType(BetType.SINGLE);
        ticket.setLines(req.lines().stream().map(line -> line.stream().sorted().toList()).toList());
        ticket.setCost(req.lines().size() * gameProperties.pointsPerBet());
        ticket.setStatus(TicketStatus.PENDING);
        ticket.setIdempotencyKey(req.idempotencyKey());

        Long balance = transactionTemplate.execute(status -> {
            Ticket saved = ticketRepository.insert(ticket);
            return walletService.debit(userId, saved.getCost(), WalletTransactionType.BET, saved.getId());
        });
        return new PlaceBetResponse(TicketResponse.from(ticket), balance);
    }

    public PageResult<TicketResponse> myTickets(String userId, int page, int size){
        Pageable pageable = Pagination.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageResult.of(ticketRepository.findByUserId(userId,pageable).map(TicketResponse::from));
    }

    public List<Ticket> ticketsOfDraw(String drawNo){
        return ticketRepository.findByDrawNo(drawNo);
    }

    public List<Ticket> paidTicketsOfDraw(String drawNo){
        return ticketRepository.findByDrawNoAndStatus(drawNo, TicketStatus.PAID);
    }

    public List<Ticket> wonTicketsOfDraw(String drawNo){
        return ticketRepository.findByDrawNoAndStatus(drawNo, TicketStatus.WON);
    }

    public void recordResult(String ticketId, List<LineResult> results, long payout, Instant now){
        Query query = Query.query(Criteria.where("_id").is(ticketId).and("status").is(TicketStatus.PENDING));
        Update update = new Update()
                .set("status",payout > 0 ? TicketStatus.WON : TicketStatus.LOST)
                .set("results",results)
                .set("payout",payout)
                .set("settledAt",now)
                .set("updatedAt",now);
        mongoTemplate.updateFirst(query,update,Ticket.class);
    }

    public void markPaid(String ticketId, Instant now){
        Query query = Query.query(Criteria.where("_id").is(ticketId).and("status").is(TicketStatus.WON));
        Update update = new Update()
                .set("status", TicketStatus.PAID)
                .set("updatedAt", now);
        mongoTemplate.updateFirst(query, update, Ticket.class);
    }

    record WinRow(String drawNo, Instant settledAt, long payout, List<LineResult> results) {
    }

    record UserWins(@Id String userId, List<WinRow> wins) {
    }

    // 每個人最近 limit 次中獎（已派彩的注單），由新到舊；沒中過獎的人不會出現在 Map 裡
    public Map<String, List<RecentWin>> recentWins(Collection<String> userIds, int limit) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("userId").in(userIds).and("status").is(TicketStatus.PAID)),
                Aggregation.stage("""
                        { $group: {
                            _id: "$userId",
                            wins: { $topN: {
                                n: %d,
                                sortBy: { settledAt: -1 },
                                output: { drawNo: "$drawNo", settledAt: "$settledAt", payout: "$payout", results: "$results" }
                            } }
                        } }
                        """.formatted(limit)));
        return mongoTemplate.aggregate(aggregation, Ticket.class, UserWins.class)
                .getMappedResults()
                .stream()
                .collect(Collectors.toMap(UserWins::userId,
                        row -> row.wins().stream().map(BettingService::toRecentWin).toList()));
    }

    private static RecentWin toRecentWin(WinRow row) {
        List<PrizeTier> tiers = row.results().stream()
                .map(LineResult::tier)
                .filter(Objects::nonNull)
                .toList();
        PrizeTier best = tiers.stream().min(Comparator.naturalOrder()).orElse(null);
        return new RecentWin(row.drawNo(), row.settledAt(), row.payout(), best, tiers.size());
    }

    private PlaceBetResponse withBalance(Ticket ticket, String userId) {
        return new PlaceBetResponse(TicketResponse.from(ticket), walletService.balance(userId).balance());
    }

    private static void pause(int attempt) {
        try {
            Thread.sleep(50L * attempt);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
