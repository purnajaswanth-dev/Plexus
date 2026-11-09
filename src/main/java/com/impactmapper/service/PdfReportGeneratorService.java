package com.impactmapper.service;

import com.impactmapper.dto.ImpactAnalysisResult;
import com.impactmapper.dto.ImpactFinding;
import com.impactmapper.dto.ImpactedRepo;
import com.lowagie.text.*;
import com.lowagie.text.Font;
import com.lowagie.text.pdf.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@Slf4j
public class PdfReportGeneratorService {

    // Brand Palette
    private static final Color PRIMARY_COLOR = new Color(15, 23, 42);      // #0f172a
    private static final Color SECONDARY_COLOR = new Color(71, 85, 105);   // #475569
    private static final Color ACCENT_BLUE = new Color(37, 99, 235);       // #2563eb
    private static final Color BORDER_COLOR = new Color(226, 232, 240);    // #e2e8f0
    private static final Color BG_SUBTLE = new Color(248, 250, 252);       // #f8fafc
    private static final Color COLOR_BREAKING = new Color(220, 38, 38);    // #dc2626
    private static final Color COLOR_WARNING = new Color(217, 119, 6);     // #d97706
    private static final Color COLOR_SAFE = new Color(5, 150, 105);        // #059669

    // Typography
    private static final Font FONT_TITLE = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 22, PRIMARY_COLOR);
    private static final Font FONT_SUBTITLE = FontFactory.getFont(FontFactory.HELVETICA, 12, SECONDARY_COLOR);
    private static final Font FONT_H1 = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 15, PRIMARY_COLOR);
    private static final Font FONT_H2 = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, PRIMARY_COLOR);
    private static final Font FONT_BODY = FontFactory.getFont(FontFactory.HELVETICA, 9.5f, PRIMARY_COLOR);
    private static final Font FONT_BODY_MUTED = FontFactory.getFont(FontFactory.HELVETICA, 9.0f, SECONDARY_COLOR);
    private static final Font FONT_BODY_BOLD = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9.5f, PRIMARY_COLOR);
    private static final Font FONT_TABLE_HEADER = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9.0f, Color.WHITE);
    private static final Font FONT_CODE = FontFactory.getFont(FontFactory.COURIER, 8.5f, PRIMARY_COLOR);

    public byte[] generateImpactReportPdf(ImpactAnalysisResult result) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 40, 40, 50, 50);

        try {
            PdfWriter writer = PdfWriter.getInstance(document, out);
            writer.setPageEvent(new HeaderFooterPageEvent());
            document.open();

            // 1. Cover Page
            buildCoverPage(document, result);
            document.newPage();

            // 2. Executive Summary
            buildExecutiveSummary(document, result);

            // 3. Version Change Analysis
            buildVersionAnalysis(document, result);

            // 4. Impact Summary & Risk Distribution
            buildImpactSummary(document, result);

            // 5. Detailed Repository Impact Analysis
            buildDetailedRepositoryAnalysis(document, result);

            // 6. Cross-Repository Analysis & Version Divergence
            buildCrossRepoAnalysis(document, result);

            // 7. Migration and Validation Plan
            buildMigrationPlan(document, result);

            // 8. Final Engineering Recommendation
            buildFinalRecommendation(document, result);

            // 9. Methodology and Limitations
            buildMethodologySection(document, result);

            document.close();
            return out.toByteArray();

        } catch (Exception e) {
            log.error("Failed to generate PDF impact report", e);
            throw new RuntimeException("PDF generation failed: " + e.getMessage(), e);
        }
    }

    private void buildCoverPage(Document doc, ImpactAnalysisResult result) throws DocumentException {
        Paragraph spacing = new Paragraph("\n\n\n");
        doc.add(spacing);

        // Header Tag
        Paragraph tag = new Paragraph("ENGINEERING ASSESSMENT REPORT", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, ACCENT_BLUE));
        tag.setSpacingAfter(8);
        doc.add(tag);

        // Document Title
        Paragraph title = new Paragraph("DEPENDENCY UPGRADE\nIMPACT ASSESSMENT", FONT_TITLE);
        title.setLeading(26);
        title.setSpacingAfter(12);
        doc.add(title);

        Paragraph subtitle = new Paragraph("Automated Semantic Versioning Heuristic Risk Evaluation & Migration Blueprint", FONT_SUBTITLE);
        subtitle.setSpacingAfter(36);
        doc.add(subtitle);

        // Metadata Table
        PdfPTable metaTable = new PdfPTable(2);
        metaTable.setWidthPercentage(100);
        metaTable.setWidths(new float[]{35f, 65f});
        metaTable.setSpacingAfter(30);

        addMetaRow(metaTable, "Target Library", result.getLibraryName());
        addMetaRow(metaTable, "Baseline Version", result.getFromVersion());
        addMetaRow(metaTable, "Proposed Target Version", result.getToVersion());
        addMetaRow(metaTable, "Version Increment", result.getVersionDifference() != null ? result.getVersionDifference() : "MAJOR");
        addMetaRow(metaTable, "Total Affected Repositories", String.valueOf(result.getTotalAffectedRepos()));
        addMetaRow(metaTable, "Assessment Date", result.getAnalysisTime() != null ? result.getAnalysisTime().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) : "N/A");
        addMetaRow(metaTable, "Engine Platform", "Cross-Repo Dependency Impact Mapper v1.0.0");
        doc.add(metaTable);

        // Overall Outcome Box
        PdfPTable outcomeTable = new PdfPTable(1);
        outcomeTable.setWidthPercentage(100);

        PdfPCell outcomeCell = new PdfPCell();
        outcomeCell.setPadding(16);
        outcomeCell.setBorderColor(BORDER_COLOR);
        outcomeCell.setBorderWidth(1f);

        Color outcomeBg = BG_SUBTLE;
        Color outcomeText = PRIMARY_COLOR;
        String outcome = result.getOverallRecommendation() != null ? result.getOverallRecommendation() : "PROCEED WITH CAUTION";

        if ("INVESTIGATE BEFORE UPGRADING".equalsIgnoreCase(outcome)) {
            outcomeBg = new Color(254, 242, 242);
            outcomeText = COLOR_BREAKING;
        } else if ("PROCEED WITH CAUTION".equalsIgnoreCase(outcome)) {
            outcomeBg = new Color(255, 251, 235);
            outcomeText = COLOR_WARNING;
        } else {
            outcomeBg = new Color(236, 253, 245);
            outcomeText = COLOR_SAFE;
        }

        outcomeCell.setBackgroundColor(outcomeBg);
        outcomeCell.addElement(new Paragraph("OVERALL STRATEGIC RECOMMENDATION", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, outcomeText)));
        outcomeCell.addElement(new Paragraph(outcome, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 15, outcomeText)));
        outcomeCell.addElement(new Paragraph(result.getRecommendationReason() != null ? result.getRecommendationReason() : "", FONT_BODY));
        outcomeTable.addCell(outcomeCell);
        doc.add(outcomeTable);
    }

    private void addMetaRow(PdfPTable table, String label, String value) {
        PdfPCell c1 = new PdfPCell(new Phrase(label, FONT_BODY_BOLD));
        c1.setBackgroundColor(BG_SUBTLE);
        c1.setPadding(7);
        c1.setBorderColor(BORDER_COLOR);

        PdfPCell c2 = new PdfPCell(new Phrase(value, FONT_BODY));
        c2.setPadding(7);
        c2.setBorderColor(BORDER_COLOR);

        table.addCell(c1);
        table.addCell(c2);
    }

    private void buildExecutiveSummary(Document doc, ImpactAnalysisResult result) throws DocumentException {
        addSectionHeader(doc, "1. Executive Summary");

        Paragraph p1 = new Paragraph(result.getExecutiveSummary() != null ? result.getExecutiveSummary() :
                "This assessment evaluates upgrading the declared dependency across indexed repositories. Analysis establishes potential breaking changes based on semantic version increments.", FONT_BODY);
        p1.setSpacingAfter(12);
        p1.setLeading(14);
        doc.add(p1);

        Paragraph p2 = new Paragraph(
                "Upgrades across shared dependencies introduce coupling risks when multiple microservices or internal applications consume different version lines. " +
                "Maintaining architectural hygiene requires synchronizing major library increments to prevent runtime classloader collisions, REST interface discrepancies, and security divergence.", FONT_BODY);
        p2.setSpacingAfter(16);
        p2.setLeading(14);
        doc.add(p2);
    }

    private void buildVersionAnalysis(Document doc, ImpactAnalysisResult result) throws DocumentException {
        addSectionHeader(doc, "2. Version Change Analysis");

        PdfPTable table = new PdfPTable(3);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{30f, 30f, 40f});
        table.setSpacingAfter(14);

        addTableHeader(table, new String[]{"Baseline Version", "Proposed Target", "Semantic Transition"});
        addTableCell(table, result.getFromVersion(), false);
        addTableCell(table, result.getToVersion(), false);
        addTableCell(table, (result.getVersionDifference() != null ? result.getVersionDifference() : "MAJOR") + " VERSION INCREMENT", true);
        doc.add(table);

        Paragraph note = new Paragraph(
                "SemVer Heuristic Rules: Major version increments (X.0.0) imply incompatible API modifications requiring migration audits. " +
                "Minor releases (0.X.0) introduce backward-compatible features and deprecations. Patch releases (0.0.X) contain backward-compatible bug fixes.", FONT_BODY_MUTED);
        note.setSpacingAfter(16);
        note.setLeading(13);
        doc.add(note);
    }

    private void buildImpactSummary(Document doc, ImpactAnalysisResult result) throws DocumentException {
        addSectionHeader(doc, "3. Risk Distribution Summary");

        PdfPTable summaryTable = new PdfPTable(4);
        summaryTable.setWidthPercentage(100);
        summaryTable.setWidths(new float[]{25f, 25f, 25f, 25f});
        summaryTable.setSpacingAfter(16);

        addTableHeader(summaryTable, new String[]{"Classification", "Affected Count", "Proportion", "Typical Action"});

        long total = Math.max(1, result.getTotalAffectedRepos());
        int breaking = result.getBreakingCount();
        int warning = result.getWarningCount();
        int safe = result.getSafeCount();

        addRiskSummaryRow(summaryTable, "BREAKING", breaking, String.format("%.1f%%", (breaking * 100.0 / total)), "Staging migration audit", COLOR_BREAKING);
        addRiskSummaryRow(summaryTable, "WARNING", warning, String.format("%.1f%%", (warning * 100.0 / total)), "Review deprecations", COLOR_WARNING);
        addRiskSummaryRow(summaryTable, "SAFE", safe, String.format("%.1f%%", (safe * 100.0 / total)), "Automated CI verification", COLOR_SAFE);

        doc.add(summaryTable);
    }

    private void addRiskSummaryRow(PdfPTable table, String name, int count, String pct, String action, Color badgeColor) {
        PdfPCell c1 = new PdfPCell(new Phrase(name, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, badgeColor)));
        c1.setPadding(6);
        c1.setBorderColor(BORDER_COLOR);

        PdfPCell c2 = new PdfPCell(new Phrase(String.valueOf(count), FONT_BODY_BOLD));
        c2.setPadding(6);
        c2.setBorderColor(BORDER_COLOR);

        PdfPCell c3 = new PdfPCell(new Phrase(pct, FONT_BODY));
        c3.setPadding(6);
        c3.setBorderColor(BORDER_COLOR);

        PdfPCell c4 = new PdfPCell(new Phrase(action, FONT_BODY));
        c4.setPadding(6);
        c4.setBorderColor(BORDER_COLOR);

        table.addCell(c1);
        table.addCell(c2);
        table.addCell(c3);
        table.addCell(c4);
    }

    private void buildDetailedRepositoryAnalysis(Document doc, ImpactAnalysisResult result) throws DocumentException {
        addSectionHeader(doc, "4. Detailed Repository Impact Analysis");

        List<ImpactedRepo> repos = result.getAllImpactedRepos();
        if (repos == null || repos.isEmpty()) {
            doc.add(new Paragraph("No repositories are currently impacted by this library update.", FONT_BODY));
            return;
        }

        for (int i = 0; i < repos.size(); i++) {
            ImpactedRepo r = repos.get(i);

            PdfPTable repoBox = new PdfPTable(1);
            repoBox.setWidthPercentage(100);
            repoBox.setSpacingAfter(10);

            PdfPCell cell = new PdfPCell();
            cell.setPadding(10);
            cell.setBorderColor(BORDER_COLOR);
            cell.setBackgroundColor(BG_SUBTLE);

            // Repository Header
            Paragraph rHead = new Paragraph();
            rHead.add(new Chunk(String.format("4.%d Repository: %s", (i + 1), r.getRepoName()), FONT_H2));
            rHead.add(new Chunk("  [" + r.getImpactLevel() + "]", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10,
                    "BREAKING".equals(r.getImpactLevel()) ? COLOR_BREAKING : ("WARNING".equals(r.getImpactLevel()) ? COLOR_WARNING : COLOR_SAFE))));
            cell.addElement(rHead);

            // Meta line
            Paragraph meta = new Paragraph();
            meta.add(new Chunk("GitHub: ", FONT_BODY_BOLD));
            meta.add(new Chunk(r.getRepoUrl() != null ? r.getRepoUrl() : "N/A", FONT_CODE));
            meta.add(new Chunk(" | Scope: " + (r.getDependencyScope() != null ? r.getDependencyScope() : "compile"), FONT_BODY));
            meta.add(new Chunk(String.format(" | Version Transition: %s -> %s", r.getCurrentVersion(), r.getTargetVersion()), FONT_BODY_BOLD));
            meta.setSpacingAfter(4);
            cell.addElement(meta);

            // Reason & Evidence
            Paragraph reasonPara = new Paragraph();
            reasonPara.add(new Chunk("Detected Finding: ", FONT_BODY_BOLD));
            reasonPara.add(new Chunk(r.getReason(), FONT_BODY));
            reasonPara.setSpacingAfter(3);
            cell.addElement(reasonPara);

            // Recommendation
            Paragraph actionPara = new Paragraph();
            actionPara.add(new Chunk("Recommended Action: ", FONT_BODY_BOLD));
            actionPara.add(new Chunk(r.getRecommendedAction(), FONT_BODY));
            cell.addElement(actionPara);

            repoBox.addCell(cell);
            doc.add(repoBox);
        }
    }

    private void buildCrossRepoAnalysis(Document doc, ImpactAnalysisResult result) throws DocumentException {
        addSectionHeader(doc, "5. Cross-Repository Version Divergence");

        Paragraph p = new Paragraph(
                "Tracking cross-repository version adoption prevents fragmentation across teams. " +
                "Repositories using diverged version lines run the risk of inconsistent transitives and differing behavior when integrated into unified runtimes.", FONT_BODY);
        p.setSpacingAfter(10);
        p.setLeading(14);
        doc.add(p);

        PdfPTable table = new PdfPTable(3);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{45f, 25f, 30f});
        table.setSpacingAfter(16);

        addTableHeader(table, new String[]{"Repository", "Current Line", "Target Risk Status"});

        for (ImpactedRepo r : result.getAllImpactedRepos()) {
            addTableCell(table, r.getRepoName(), false);
            addTableCell(table, r.getCurrentVersion(), false);
            addTableCell(table, r.getImpactLevel(), false);
        }

        doc.add(table);
    }

    private void buildMigrationPlan(Document doc, ImpactAnalysisResult result) throws DocumentException {
        addSectionHeader(doc, "6. Migration and Validation Blueprint");

        Paragraph p = new Paragraph("A phased engineering execution plan is recommended prior to production deployment:", FONT_BODY);
        p.setSpacingAfter(8);
        doc.add(p);

        String[] steps = {
                "Step 1: Release Notes Audit — Inspect official release notes and migration guides for breaking changes and removed APIs.",
                "Step 2: Staging Branch Isolation — Create an isolated upgrade branch and update manifest declarations.",
                "Step 3: Compilation & Static Verification — Execute local builds to ensure clean syntax and dependency convergence.",
                "Step 4: Automated Test Execution — Run unit test suites, integration tests, and contractual API regression tests.",
                "Step 5: Staging Verification & Rollback Preparation — Deploy to a canary/staging environment with pre-verified rollback configuration."
        };

        for (String step : steps) {
            Paragraph stepPara = new Paragraph("• " + step, FONT_BODY);
            stepPara.setSpacingAfter(4);
            stepPara.setLeading(13);
            doc.add(stepPara);
        }
        doc.add(new Paragraph("\n"));
    }

    private void buildFinalRecommendation(Document doc, ImpactAnalysisResult result) throws DocumentException {
        addSectionHeader(doc, "7. Strategic Engineering Recommendation");

        PdfPTable table = new PdfPTable(1);
        table.setWidthPercentage(100);

        PdfPCell cell = new PdfPCell();
        cell.setPadding(12);
        cell.setBorderColor(BORDER_COLOR);
        cell.setBackgroundColor(BG_SUBTLE);

        String outcome = result.getOverallRecommendation() != null ? result.getOverallRecommendation() : "PROCEED WITH CAUTION";
        Color col = "INVESTIGATE BEFORE UPGRADING".equalsIgnoreCase(outcome) ? COLOR_BREAKING : ("PROCEED WITH CAUTION".equalsIgnoreCase(outcome) ? COLOR_WARNING : COLOR_SAFE);

        cell.addElement(new Paragraph("DECISION OUTCOME: " + outcome, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, col)));
        cell.addElement(new Paragraph(result.getRecommendationReason(), FONT_BODY));

        table.addCell(cell);
        doc.add(table);
        doc.add(new Paragraph("\n"));
    }

    private void buildMethodologySection(Document doc, ImpactAnalysisResult result) throws DocumentException {
        addSectionHeader(doc, "8. Methodology & Analysis Scope");

        Paragraph p = new Paragraph(
                "Methodology Disclaimer: Findings in this document are generated by static manifest parsing and Semantic Versioning (SemVer) heuristic risk algorithms. " +
                "A 'BREAKING' classification reflects a major version boundary where incompatible changes are customary; it does not constitute bytecode-level runtime failure proof. " +
                "Engineers must validate actual code paths using automated test suites and official migration guides.", FONT_BODY_MUTED);
        p.setLeading(13);
        doc.add(p);
    }

    private void addSectionHeader(Document doc, String title) throws DocumentException {
        Paragraph h = new Paragraph(title, FONT_H1);
        h.setSpacingBefore(12);
        h.setSpacingAfter(8);
        doc.add(h);
    }

    private void addTableHeader(PdfPTable table, String[] headers) {
        for (String h : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(h, FONT_TABLE_HEADER));
            cell.setBackgroundColor(PRIMARY_COLOR);
            cell.setPadding(6);
            cell.setBorderColor(PRIMARY_COLOR);
            table.addCell(cell);
        }
    }

    private void addTableCell(PdfPTable table, String text, boolean bold) {
        PdfPCell cell = new PdfPCell(new Phrase(text != null ? text : "", bold ? FONT_BODY_BOLD : FONT_BODY));
        cell.setPadding(6);
        cell.setBorderColor(BORDER_COLOR);
        table.addCell(cell);
    }

    // Header & Footer Event
    private static class HeaderFooterPageEvent extends PdfPageEventHelper {
        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            PdfContentByte cb = writer.getDirectContent();

            // Do not show header/footer on cover page (page 1)
            if (writer.getPageNumber() == 1) return;

            // Header
            ColumnText.showTextAligned(cb, Element.ALIGN_LEFT,
                    new Phrase("Cross-Repo Dependency Impact Mapper — Engineering Assessment", FontFactory.getFont(FontFactory.HELVETICA, 8, SECONDARY_COLOR)),
                    document.left(), document.top() + 15, 0);

            // Running Line
            cb.setColorStroke(BORDER_COLOR);
            cb.setLineWidth(0.5f);
            cb.moveTo(document.left(), document.top() + 10);
            cb.lineTo(document.right(), document.top() + 10);
            cb.stroke();

            // Footer
            ColumnText.showTextAligned(cb, Element.ALIGN_RIGHT,
                    new Phrase(String.format("Page %d", writer.getPageNumber()), FontFactory.getFont(FontFactory.HELVETICA, 8, SECONDARY_COLOR)),
                    document.right(), document.bottom() - 15, 0);

            ColumnText.showTextAligned(cb, Element.ALIGN_LEFT,
                    new Phrase("Confidential — Internal Engineering Assessment", FontFactory.getFont(FontFactory.HELVETICA, 8, SECONDARY_COLOR)),
                    document.left(), document.bottom() - 15, 0);
        }
    }
}

