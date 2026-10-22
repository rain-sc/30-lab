package com.marksixlab.settlement.service;

import com.marksixlab.betting.model.LineResult;
import com.marksixlab.betting.model.PrizeTier;
import com.marksixlab.betting.model.Ticket;
import com.marksixlab.betting.model.TicketStatus;
import com.marksixlab.betting.service.BettingService;
import com.marksixlab.draw.model.Draw;
import com.marksixlab.draw.model.PrizeSummary;
import com.marksixlab.draw.model.TierWinners;
import com.marksixlab.draw.service.DrawService;
import com.marksixlab.draw.service.DrawSlot;
import com.marksixlab.settlement.dto.JackpotResponse;
import com.marksixlab.wallet.model.WalletTransactionType;
import com.marksixlab.wallet.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SettlementService {

    private final DrawService drawService;
    private final BettingService bettingService;
    private final WalletService walletService;
    private final PrizeCalculator prizeCalculator;

    public Optional<Draw> settleNext(Instant now){
        return drawService.nextToSettle().map(draw -> settle(draw,now));
    }

    public JackpotResponse currentJackpot(Instant now){
        DrawSlot slot = drawService.slotAt(now);
        long turnover = turnover(bettingService.ticketsOfDraw(slot.drawNo()));
        long amount = prizeCalculator.jackpotPool(drawService.previousRollover(slot.drawAt()),turnover);
        return new JackpotResponse(slot.drawNo(),amount);
    }

    private Draw settle(Draw draw, Instant now){
        List<Ticket> tickets = bettingService.ticketsOfDraw(draw.getDrawNo());

        long turnover = turnover(tickets);
        long pool = prizeCalculator.jackpotPool(drawService.previousRollover(draw.getDrawAt()), turnover);

        int jackpotLines = (int) tickets.stream()
                .flatMap(ticket -> ticket.getLines().stream())
                .filter(line -> isJackpot(line, draw))
                .count();
        long share = jackpotLines == 0 ? 0 : pool / jackpotLines;
        long rollover = jackpotLines == 0 ? pool : pool % jackpotLines;

        for(Ticket ticket : tickets){
            if(ticket.getStatus() != TicketStatus.PENDING){
                continue;
            }
            List<LineResult> results = ticket.getLines().stream()
                    .map(line -> prizeCalculator.judge(line, draw.getNumbers(),draw.getSpecialNumber(),share))
                    .toList();
            long payout = results.stream().mapToLong(LineResult::prize).sum();
            bettingService.recordResult(ticket.getId(), results, payout, now);
        }

        for(Ticket ticket : bettingService.wonTicketsOfDraw(draw.getDrawNo())){
            try{
                walletService.credit(ticket.getUserId(), ticket.getPayout(), WalletTransactionType.PAYOUT, ticket.getId());
            }catch (DuplicateKeyException e){
                // 上次已經派過（結算到一半中斷後重跑），直接標成已派彩
            }
            bettingService.markPaid(ticket.getId(), now);
        }
        PrizeSummary prizeSummary = summarize(draw, tickets, share);
        return drawService.markSettled(draw.getDrawNo(), pool, jackpotLines, rollover, prizeSummary, now);
    }

    // 補算：已結算但還沒有獎級統計的期數（這個功能上線前結算的）；可以重複執行，補過的不會再補
    public int backfillPrizeSummaries(){
        int filled = 0;
        for(Draw draw : drawService.settledWithoutPrizeSummary()){
            int jackpotLines = draw.getJackpotWinners() == null ? 0 : draw.getJackpotWinners();
            long share = jackpotLines == 0 ? 0 : draw.getPoolAmount() / jackpotLines;
            PrizeSummary prizeSummary = summarize(draw, bettingService.ticketsOfDraw(draw.getDrawNo()), share);
            if(drawService.savePrizeSummary(draw.getDrawNo(), prizeSummary)){
                filled++;
            }
        }
        return filled;
    }

    // 這期每個獎級中了幾注、每注多少、幾個人中獎、總派彩
    private PrizeSummary summarize(Draw draw, List<Ticket> tickets, long jackpotShare){
        Map<PrizeTier, Integer> lines = new EnumMap<>(PrizeTier.class);
        Set<String> winners = new HashSet<>();
        long totalPayout = 0;
        for(Ticket ticket : tickets){
            for(List<Integer> line : ticket.getLines()){
                LineResult result = prizeCalculator.judge(line, draw.getNumbers(), draw.getSpecialNumber(), jackpotShare);
                if(result.tier() != null){
                    lines.merge(result.tier(), 1, Integer::sum);
                    winners.add(ticket.getUserId());
                    totalPayout += result.prize();
                }
            }
        }
        List<TierWinners> tiers = Arrays.stream(PrizeTier.values())
                .map(tier -> new TierWinners(tier, lines.getOrDefault(tier, 0),
                        tier == PrizeTier.FIRST ? jackpotShare : prizeCalculator.fixedPrize(tier)))
                .toList();
        return new PrizeSummary(winners.size(), totalPayout, tiers);
    }

    private static long turnover(List<Ticket> tickets){
        return tickets.stream().mapToLong(Ticket::getCost).sum();
    }

    private boolean isJackpot(List<Integer> line, Draw draw){
        return prizeCalculator.judge(line, draw.getNumbers(),draw.getSpecialNumber(), 0).tier() == PrizeTier.FIRST;
    }
}
