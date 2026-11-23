const asyncHandler = require('../utils/asyncHandler');
const reportService = require('../services/reportService');
const ApiError = require('../utils/ApiError');

function extractFilters(query) {
  return {
    startDate: query.startDate || '',
    endDate: query.endDate || '',
    itemId: query.itemId || '',
    categoryId: query.categoryId || '',
    transactionType: query.transactionType || '',
    userId: query.userId || '',
  };
}

const getReport = (reportType) =>
  asyncHandler(async (req, res) => {
    const cfg = reportService.REPORT_CONFIG[reportType];
    if (!cfg) {
      throw new ApiError(400, 'Invalid report type.');
    }

    const filters = extractFilters(req.query);
    const format = String(req.query.format || 'json').toLowerCase();

    if (format === 'csv') {
      const csv = await reportService.generateCsv(reportType, filters);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="buildmore-${reportType}-report.csv"`);
      return res.send(csv);
    }

    if (format === 'excel' || format === 'xlsx') {
      const buffer = await reportService.generateExcelBuffer(reportType, filters);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="buildmore-${reportType}-report.xlsx"`);
      return res.send(Buffer.from(buffer));
    }

    if (format === 'pdf') {
      const buffer = await reportService.generatePdfBuffer(reportType, filters);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="buildmore-${reportType}-report.pdf"`);
      return res.send(buffer);
    }

    const data = await cfg.fetch(filters);
    return res.json({
      success: true,
      title: cfg.title,
      columns: cfg.columns,
      data,
    });
  });

module.exports = { getReport };
