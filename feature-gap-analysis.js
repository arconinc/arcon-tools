const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, VerticalAlign
} = require('docx');
const fs = require('fs');

// ─── Colors ───────────────────────────────────────────────────────────────────
const PURPLE = "6B21A8";
const PURPLE_LIGHT = "EDE9FE";
const GREEN_LIGHT = "DCFCE7";
const YELLOW_LIGHT = "FEF9C3";
const RED_LIGHT = "FEE2E2";
const BLUE_LIGHT = "DBEAFE";
const GRAY_BG = "F3F4F6";
const GRAY_BORDER = "D1D5DB";
const WHITE = "FFFFFF";
const BLACK = "111827";

const border = { style: BorderStyle.SINGLE, size: 1, color: GRAY_BORDER };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function spacer(size = 120) {
  return new Paragraph({ children: [new TextRun("")], spacing: { before: size, after: size } });
}

function sectionHeading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 28, color: WHITE, font: "Arial" })],
    shading: { fill: PURPLE, type: ShadingType.CLEAR },
    spacing: { before: 360, after: 160 },
    indent: { left: 200, right: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: PURPLE } },
  });
}

function subHeading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, color: PURPLE, font: "Arial" })],
    spacing: { before: 280, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: PURPLE_LIGHT } },
  });
}

function bodyText(text, options = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Arial", color: BLACK, ...options })],
    spacing: { before: 60, after: 60 },
  });
}

function statusRow(icon, feature, status, statusColor) {
  const cellPad = { top: 100, bottom: 100, left: 160, right: 160 };
  return new TableRow({
    children: [
      new TableCell({
        borders,
        width: { size: 500, type: WidthType.DXA },
        margins: cellPad,
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: WHITE, type: ShadingType.CLEAR },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: icon, size: 22, font: "Arial" })]
        })]
      }),
      new TableCell({
        borders,
        width: { size: 3860, type: WidthType.DXA },
        margins: cellPad,
        shading: { fill: WHITE, type: ShadingType.CLEAR },
        children: [new Paragraph({
          children: [new TextRun({ text: feature, bold: true, size: 22, font: "Arial", color: BLACK })]
        })]
      }),
      new TableCell({
        borders,
        width: { size: 5000, type: WidthType.DXA },
        margins: cellPad,
        shading: { fill: statusColor, type: ShadingType.CLEAR },
        children: [new Paragraph({
          children: [new TextRun({ text: status, size: 20, font: "Arial", color: BLACK })]
        })]
      }),
    ]
  });
}

function tableHeader(col1, col2, col3) {
  const cellPad = { top: 100, bottom: 100, left: 160, right: 160 };
  return new TableRow({
    tableHeader: true,
    children: [col1, col2, col3].map((label, i) => new TableCell({
      borders,
      width: { size: [500, 3860, 5000][i], type: WidthType.DXA },
      margins: cellPad,
      shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
      children: [new Paragraph({
        children: [new TextRun({ text: label, bold: true, size: 20, font: "Arial", color: BLACK })]
      })]
    }))
  });
}

function easyWinCard(num, title, effort, effortColor, bullets) {
  const cellPad = { top: 120, bottom: 120, left: 180, right: 180 };
  // Number cell
  const numCell = new TableCell({
    borders: noBorders,
    width: { size: 600, type: WidthType.DXA },
    margins: cellPad,
    shading: { fill: PURPLE, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: String(num), bold: true, size: 28, font: "Arial", color: WHITE })]
    })]
  });
  // Content cell
  const contentChildren = [
    new Paragraph({
      children: [
        new TextRun({ text: title, bold: true, size: 24, font: "Arial", color: BLACK }),
        new TextRun({ text: "   " }),
        new TextRun({ text: effort, size: 18, font: "Arial", color: BLACK,
          shading: { fill: effortColor, type: ShadingType.CLEAR }, bold: true }),
      ],
      spacing: { before: 60, after: 80 },
    }),
    ...bullets.map(b => new Paragraph({
      numbering: { reference: "cards-bullets", level: 0 },
      children: [new TextRun({ text: b, size: 20, font: "Arial", color: "374151" })],
      spacing: { before: 30, after: 30 },
    }))
  ];
  const contentCell = new TableCell({
    borders: noBorders,
    width: { size: 8760, type: WidthType.DXA },
    margins: cellPad,
    shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
    children: contentChildren,
  });
  return new TableRow({ children: [numCell, contentCell] });
}

function heavyLiftRow(title, description) {
  const cellPad = { top: 100, bottom: 100, left: 160, right: 160 };
  return new TableRow({
    children: [
      new TableCell({
        borders,
        width: { size: 3200, type: WidthType.DXA },
        margins: cellPad,
        shading: { fill: RED_LIGHT, type: ShadingType.CLEAR },
        children: [new Paragraph({
          children: [new TextRun({ text: title, bold: true, size: 22, font: "Arial", color: BLACK })]
        })]
      }),
      new TableCell({
        borders,
        width: { size: 6160, type: WidthType.DXA },
        margins: cellPad,
        shading: { fill: WHITE, type: ShadingType.CLEAR },
        children: [new Paragraph({
          children: [new TextRun({ text: description, size: 20, font: "Arial", color: "374151" })]
        })]
      }),
    ]
  });
}

// ─── Document ─────────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "cards-bullets",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "\u2013",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 440, hanging: 220 } } }
        }]
      }
    ]
  },
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22 } }
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: WHITE },
        paragraph: { spacing: { before: 0, after: 0 }, outlineLevel: 0 }
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: PURPLE },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 }
      },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
      }
    },
    children: [

      // ── Title Block ──────────────────────────────────────────────────────────
      new Paragraph({
        children: [new TextRun({ text: "Arcon Tools App", bold: true, size: 52, font: "Arial", color: WHITE })],
        shading: { fill: PURPLE, type: ShadingType.CLEAR },
        spacing: { before: 0, after: 0 },
        indent: { left: 360, right: 360 },
        alignment: AlignmentType.LEFT,
      }),
      new Paragraph({
        children: [new TextRun({ text: "Feature Gap Analysis", size: 36, font: "Arial", color: "D8B4FE" })],
        shading: { fill: PURPLE, type: ShadingType.CLEAR },
        spacing: { before: 0, after: 0 },
        indent: { left: 360, right: 360 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "April 1, 2026", size: 22, font: "Arial", color: "C4B5FD", italics: true })],
        shading: { fill: PURPLE, type: ShadingType.CLEAR },
        spacing: { before: 0, after: 240 },
        indent: { left: 360, right: 360 },
      }),

      // ── Already on Par ───────────────────────────────────────────────────────
      sectionHeading("SECTION 1 \u2014 Already On Par"),

      subHeading("Intranet Homepage"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [500, 3860, 5000],
        rows: [
          tableHeader("", "Feature", "Status"),
          statusRow("\u2705", "Welcome banner", "Hero carousel with admin editor, draft/publish workflow", GREEN_LIGHT),
          statusRow("\u2705", "Birthdays & work anniversaries", "Stored in users table, surfaced in scrolling ticker strip", GREEN_LIGHT),
          statusRow("\uD83D\uDFE1", "Monthly employee highlights", "Pinned news articles serve this purpose; no dedicated spotlight UI", YELLOW_LIGHT),
        ]
      }),

      subHeading("Core Tools & Systems"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [500, 3860, 5000],
        rows: [
          tableHeader("", "Feature", "Status"),
          statusRow("\u2705", "Ticketing system", "CRM tasks with full status workflow, comments, history, and attachments", GREEN_LIGHT),
          statusRow("\u2705", "Ticket categories", "25+ categories spanning Art, CSR, Warehouse, Store/Ecommerce, etc.", GREEN_LIGHT),
          statusRow("\u2705", "Ticket priority levels", "Low / Medium / High + department-specific categories", GREEN_LIGHT),
          statusRow("\u2705", "Event countdown", "Topbar pill, admin-configurable event name & target date", GREEN_LIGHT),
        ]
      }),

      subHeading("HR & Employee Resources"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [500, 3860, 5000],
        rows: [
          tableHeader("", "Feature", "Status"),
          statusRow("\u2705", "Birth dates / anniversaries", "Stored in DB, shown in ticker", GREEN_LIGHT),
          statusRow("\uD83D\uDFE1", "Org chart data model", "manager_id, direct_reports, job_title, team all typed; needs a UI", YELLOW_LIGHT),
        ]
      }),

      subHeading("Sales Resources & Client Management"),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [500, 3860, 5000],
        rows: [
          tableHeader("", "Feature", "Status"),
          statusRow("\u2705", "Client artwork library", "CrmArtwork type with Cloudinary integration, per-customer library", GREEN_LIGHT),
          statusRow("\u2705", "Overseas supplier database", "CrmVendor covers EQP, product line, specialty, rush contacts & cutoffs", GREEN_LIGHT),
          statusRow("\u2705", "Client/contact/opportunity mgmt", "Full CRM with customers, vendors, contacts, and pipeline stages", GREEN_LIGHT),
        ]
      }),

      spacer(200),

      // ── Easy Wins ────────────────────────────────────────────────────────────
      sectionHeading("SECTION 2 \u2014 Easy Wins (Low Effort to Add)"),
      spacer(80),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [600, 8760],
        rows: [
          easyWinCard(1, "Employee Directory Page", "Very Low Effort", GREEN_LIGHT, [
            "EmployeeProfile and EmployeeSummary types are fully defined in types/index.ts",
            "Fields include: profile_image_url, job_title, team, office_location, skills, interests, bio_json",
            "Just needs a /directory page rendering existing data",
          ]),
          new TableRow({ children: [new TableCell({ borders: noBorders, width: { size: 9360, type: WidthType.DXA }, children: [spacer(60)] })] }),
          easyWinCard(2, "Org Chart", "Low Effort", GREEN_LIGHT, [
            "manager_id and direct_reports: EmployeeSummary[] already in EmployeeProfile",
            "Tree visualization can consume this directly (CSS flex tree or lightweight lib)",
          ]),
          new TableRow({ children: [new TableCell({ borders: noBorders, width: { size: 9360, type: WidthType.DXA }, children: [spacer(60)] })] }),
          easyWinCard(3, "New Hire Spotlights", "Very Low Effort", GREEN_LIGHT, [
            "Add NEW_HIRE to ArticleType union in types/index.ts",
            "Add a filtered section to the news page or dashboard",
            "WYSIWYG editor, cover images, and publish workflow all already exist",
          ]),
          new TableRow({ children: [new TableCell({ borders: noBorders, width: { size: 9360, type: WidthType.DXA }, children: [spacer(60)] })] }),
          easyWinCard(4, "Employee Photo Uploads", "Low Effort", GREEN_LIGHT, [
            "profile_image_url field already exists on AppUser",
            "Supabase Storage is already set up",
            "Can reuse upload pattern from /api/admin/banner/upload",
          ]),
          new TableRow({ children: [new TableCell({ borders: noBorders, width: { size: 9360, type: WidthType.DXA }, children: [spacer(60)] })] }),
          easyWinCard(5, "Event RSVP Tracking", "Low-Medium Effort", YELLOW_LIGHT, [
            "Countdown + event config already exists",
            "CRM contacts are already linked to customers",
            "Simple event_rsvps table (event_id, contact_id, status, rep_id) + page for sales reps",
          ]),
          new TableRow({ children: [new TableCell({ borders: noBorders, width: { size: 9360, type: WidthType.DXA }, children: [spacer(60)] })] }),
          easyWinCard(6, "Document Library (Employee Manual, HR Docs, Certifications)", "Low Effort", GREEN_LIGHT, [
            "DocSection, DocFolder, and DriveDocument types fully defined in types/index.ts",
            "Just needs DB tables verified + a /docs reader page",
          ]),
          new TableRow({ children: [new TableCell({ borders: noBorders, width: { size: 9360, type: WidthType.DXA }, children: [spacer(60)] })] }),
          easyWinCard(7, "Supplier Donation / Show Checklist Tracking", "Low Effort", GREEN_LIGHT, [
            "Model as CRM tasks (Warehouse Fulfillment category already exists)",
            "Or a lightweight table linked to CrmVendor",
          ]),
        ]
      }),

      spacer(200),

      // ── Heavier Lifts ────────────────────────────────────────────────────────
      sectionHeading("SECTION 3 \u2014 Heavier Lifts (Not Low Effort)"),
      spacer(80),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3200, 6160],
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({
                borders,
                width: { size: 3200, type: WidthType.DXA },
                margins: { top: 100, bottom: 100, left: 160, right: 160 },
                shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "Feature", bold: true, size: 20, font: "Arial" })] })]
              }),
              new TableCell({
                borders,
                width: { size: 6160, type: WidthType.DXA },
                margins: { top: 100, bottom: 100, left: 160, right: 160 },
                shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
                children: [new Paragraph({ children: [new TextRun({ text: "Why It's a Heavier Lift", bold: true, size: 20, font: "Arial" })] })]
              }),
            ]
          }),
          heavyLiftRow("Report Writer", "Needs a data pipeline from e-store order data into structured report templates"),
          heavyLiftRow("Vacation Tracking", "Needs its own approval workflow and calendar integration"),
          heavyLiftRow("Weekly KPI Dashboard", "Requires aggregation across orders on hold, aging, refunds, and support data"),
          heavyLiftRow("Dropbox Integration", "Entirely new integration — DriveDocument is Google Drive only today"),
          heavyLiftRow("External Client RSVP Portal", "Needs separate auth/access model for external attendees"),
        ]
      }),

      spacer(300),

      // ── Footer note ──────────────────────────────────────────────────────────
      new Paragraph({
        children: [new TextRun({ text: "Generated April 1, 2026  \u2022  Arcon Tools App", size: 18, font: "Arial", color: "9CA3AF", italics: true })],
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: GRAY_BORDER } },
        spacing: { before: 120 },
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("feature-gap-analysis.docx", buffer);
  console.log("Done: feature-gap-analysis.docx");
});
