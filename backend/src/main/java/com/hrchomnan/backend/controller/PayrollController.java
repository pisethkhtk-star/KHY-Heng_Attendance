package com.hrchomnan.backend.controller;

import com.hrchomnan.backend.model.*;
import com.hrchomnan.backend.repository.NssfConfigRepository;
import com.hrchomnan.backend.repository.TaxBracketRepository;
import com.hrchomnan.backend.service.PayrollService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/payroll")
@RequiredArgsConstructor
@Slf4j
public class PayrollController {

    private final PayrollService payrollService;
    private final NssfConfigRepository nssfConfigRepository;
    private final TaxBracketRepository taxBracketRepository;

    @GetMapping("/runs")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<List<PayrollRun>> getAllRuns() {
        return ResponseEntity.ok(payrollService.getAllPayrollRuns());
    }

    @PostMapping("/runs/generate")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<?> generatePayrollRun(@RequestBody Map<String, Object> body, Authentication auth) {
        try {
            int month = ((Number) body.get("month")).intValue();
            int year = ((Number) body.get("year")).intValue();
            Integer standardDays = body.containsKey("standardWorkingDays") && body.get("standardWorkingDays") != null
                    ? ((Number) body.get("standardWorkingDays")).intValue() : 26;
            BigDecimal exRate = body.containsKey("exchangeRateKhr") && body.get("exchangeRateKhr") != null
                    ? new BigDecimal(body.get("exchangeRateKhr").toString()) : null;
            String note = (String) body.get("note");
            String createdBy = auth != null ? auth.getName() : "System";

            PayrollRun run = payrollService.generatePayrollRun(month, year, standardDays, exRate, note, createdBy);
            return ResponseEntity.ok(run);
        } catch (Exception e) {
            log.error("Error generating payroll run: ", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/runs/{id}")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<?> getRunById(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(payrollService.getPayrollRunById(id));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/runs/{id}/approve")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<?> approveRun(@PathVariable UUID id, Authentication auth) {
        try {
            String approvedBy = auth != null ? auth.getName() : "HR Admin";
            return ResponseEntity.ok(payrollService.approvePayrollRun(id, approvedBy));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/runs/{id}/mark-paid")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<?> markPaid(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(payrollService.markPaidPayrollRun(id));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @DeleteMapping("/runs/{id}")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<?> deleteRun(@PathVariable UUID id) {
        try {
            payrollService.deletePayrollRun(id);
            return ResponseEntity.ok(Map.of("message", "Payroll run deleted/cleared successfully"));
        } catch (Exception e) {
            log.error("Error deleting payroll run: ", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/runs/{id}/payslips")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<List<Payslip>> getPayslipsByRun(@PathVariable UUID id) {
        return ResponseEntity.ok(payrollService.getPayslipsByRunId(id));
    }

    @GetMapping("/payslips/{id}")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<?> getPayslipById(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(payrollService.getPayslipById(id));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/payslips/{id}/adjust")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<?> adjustPayslip(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        try {
            BigDecimal bonus = body.containsKey("bonusAmount") && body.get("bonusAmount") != null
                    ? new BigDecimal(body.get("bonusAmount").toString()) : null;
            BigDecimal commission = body.containsKey("commissionAmount") && body.get("commissionAmount") != null
                    ? new BigDecimal(body.get("commissionAmount").toString()) : null;
            BigDecimal advance = body.containsKey("advanceDeduction") && body.get("advanceDeduction") != null
                    ? new BigDecimal(body.get("advanceDeduction").toString()) : null;
            BigDecimal otherDeductions = body.containsKey("otherDeductions") && body.get("otherDeductions") != null
                    ? new BigDecimal(body.get("otherDeductions").toString()) : null;
            String remarks = (String) body.get("remarks");

            Payslip updated = payrollService.adjustPayslip(id, bonus, commission, advance, otherDeductions, remarks);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/runs/{id}/export/bank")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<byte[]> exportBankBulkPayment(@PathVariable UUID id) {
        PayrollRun run = payrollService.getPayrollRunById(id);
        List<Payslip> payslips = payrollService.getPayslipsByRunId(id);

        // ABA Bank / Cambodian Bulk Payment CSV Format:
        // Debit Account, Beneficiary Account, Beneficiary Name, Amount, Currency, Payment Details
        StringBuilder csv = new StringBuilder();
        csv.append("Staff ID,Employee Name,Bank Name,Account Number,Currency,Net Amount,Payment Remark\n");

        for (Payslip p : payslips) {
            csv.append(escapeCsv(p.getStaffId())).append(",")
               .append(escapeCsv(p.getEmployeeNameEn() != null ? p.getEmployeeNameEn() : p.getEmployeeNameKh())).append(",")
               .append(escapeCsv(p.getBankName() != null ? p.getBankName() : "ABA Bank")).append(",")
               .append(escapeCsv(p.getBankAccountNumber() != null ? p.getBankAccountNumber() : "")).append(",")
               .append("USD").append(",")
               .append(p.getNetSalary() != null ? p.getNetSalary().toPlainString() : "0.00").append(",")
               .append(escapeCsv(String.format("Salary %02d/%d", run.getMonth(), run.getYear()))).append("\n");
        }

        byte[] bytes = csv.toString().getBytes(StandardCharsets.UTF_8);
        byte[] bom = new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF}; // UTF-8 BOM for Excel Khmer support
        byte[] output = new byte[bom.length + bytes.length];
        System.arraycopy(bom, 0, output, 0, bom.length);
        System.arraycopy(bytes, 0, output, bom.length, bytes.length);

        String filename = String.format("Bank_Bulk_Payment_Payroll_%02d_%d.csv", run.getMonth(), run.getYear());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(output);
    }

    @GetMapping("/salary-profiles")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<List<Map<String, Object>>> getSalaryProfiles() {
        return ResponseEntity.ok(payrollService.getAllSalaryProfiles());
    }

    @PutMapping("/salary-profiles/{staffId}")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<?> updateSalaryProfile(@PathVariable String staffId, @RequestBody EmployeeSalaryProfile body) {
        try {
            EmployeeSalaryProfile saved = payrollService.updateSalaryProfile(staffId, body);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @GetMapping("/configs")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<Map<String, Object>> getConfigs() {
        NssfConfig nssf = payrollService.getOrCreateDefaultNssfConfig();
        List<TaxBracket> brackets = payrollService.getOrCreateDefaultTaxBrackets();
        return ResponseEntity.ok(Map.of(
                "nssf", nssf,
                "taxBrackets", brackets
        ));
    }

    @PutMapping("/configs/nssf")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<?> updateNssfConfig(@RequestBody NssfConfig update) {
        try {
            return ResponseEntity.ok(payrollService.updateNssfConfig(update));
        } catch (Exception e) {
            log.error("Error updating NSSF config: ", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/configs/toggle-tax")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<?> toggleTaxCalculation(@RequestBody(required = false) Map<String, Boolean> body) {
        try {
            Boolean enabled = body != null ? body.get("isTaxEnabled") : null;
            return ResponseEntity.ok(payrollService.toggleTaxCalculation(enabled));
        } catch (Exception e) {
            log.error("Error toggling tax calculation: ", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    @PutMapping("/configs/tax-brackets")
    @PreAuthorize("@perm.has('payroll')")
    public ResponseEntity<?> updateTaxBrackets(@RequestBody List<TaxBracket> brackets) {
        try {
            return ResponseEntity.ok(payrollService.updateTaxBrackets(brackets));
        } catch (Exception e) {
            log.error("Error updating tax brackets: ", e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
        }
    }

    private String escapeCsv(String value) {
        if (value == null) return "\"\"";
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
