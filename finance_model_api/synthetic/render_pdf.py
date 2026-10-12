"""Render a synthetic statement DataFrame as a password-protected PDF in the same shape as a real one:
identity block, a summary table, then the detailed table (newest first, gridlines, wrapped details)."""
import io
from xml.sax.saxutils import escape

import pikepdf
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

GREEN = colors.HexColor("#4c9f1c")


def _money(x):
    return f"{x:,.2f}"


def render_pdf(df, path, password):
    styles = getSampleStyleSheet()
    cell = styles["BodyText"]
    cell.fontSize, cell.leading = 7, 8.5

    story = [Paragraph("MPESA FULL STATEMENT (SYNTHETIC TEST DATA)", styles["Title"]),
             Paragraph("Customer Name: Test Person", styles["Normal"]),
             Paragraph("Mobile Number: 2547***000", styles["Normal"]),
             Paragraph(f"Statement Period: {df['time'].min():%Y-%m-%d} - {df['time'].max():%Y-%m-%d}", styles["Normal"]),
             Spacer(1, 10)]

    summary = [["TRANSACTION TYPE", "PAID IN", "PAID OUT"],
               ["SEND MONEY:", "", ""], ["RECEIVED MONEY:", "", ""], ["PAYBILL:", "", ""], ["TOTAL:",
                _money(df["paid_in"].sum()), _money(df["withdrawn"].abs().sum())]]
    st = Table(summary, colWidths=[200, 90, 90])
    st.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, GREEN), ("FONTSIZE", (0, 0), (-1, -1), 8),
                            ("BACKGROUND", (0, 0), (-1, 0), GREEN), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white)]))
    story += [st, Spacer(1, 14)]

    rows = [["Receipt No.", "Completion Time", "Details", "Transaction Status", "Paid In", "Withdrawn", "Balance"]]
    for r in df.iloc[::-1].itertuples():                                   # newest first, like the real file
        rows.append([r.receipt, f"{r.time:%Y-%m-%d %H:%M:%S}", Paragraph(escape(r.details), cell), r.status,
                     _money(r.paid_in) if r.paid_in else "",
                     "-" + _money(abs(r.withdrawn)) if r.withdrawn else "", _money(r.balance)])
    table = Table(rows, colWidths=[58, 92, 172, 55, 52, 52, 54], repeatRows=1)
    table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, GREEN), ("FONTSIZE", (0, 0), (-1, -1), 7),
                               ("VALIGN", (0, 0), (-1, -1), "TOP"), ("ALIGN", (4, 1), (-1, -1), "RIGHT"),
                               ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                               ("BACKGROUND", (0, 0), (-1, 0), GREEN), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white)]))
    story.append(table)

    buf = io.BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, leftMargin=30, rightMargin=30, topMargin=30, bottomMargin=30).build(story)
    buf.seek(0)
    with pikepdf.open(buf) as pdf:
        pdf.save(path, encryption=pikepdf.Encryption(user=password, owner=password))
