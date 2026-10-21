package com.marksixlab.settlement.service;

import com.marksixlab.betting.model.LineResult;
import com.marksixlab.betting.model.PrizeTier;
import com.marksixlab.betting.model.Ticket;
import com.marksixlab.betting.model.TicketStatus;
import com.marksixlab.betting.service.BettingService;
import com.marksixlab.draw.model.Draw;
import com.marksixlab.draw.service.DrawService;
import com.marksixlab.draw.service.DrawSlot;
import com.marksixlab.settlement.dto.JackpotResponse;
import com.marksixlab.wallet.model.WalletTransactionType;
import com.marksixlab.wallet.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

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
        return drawService.markSettled(draw.getDrawNo(), pool, jackpotLines, rollover, now);
    }

    private static long turnover(List<Ticket> tickets){
        return tickets.stream().mapToLong(Ticket::getCost).sum();
    }

    private boolean isJackpot(List<Integer> line, Draw draw){
        return prizeCalculator.judge(line, draw.getNumbers(),draw.getSpecialNumber(), 0).tier() == PrizeTier.FIRST;
    }
}
