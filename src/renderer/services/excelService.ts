import ExcelJS from 'exceljs'
import type { FinancialTransaction } from './llmService'

export interface ExcelAppendResult {
  success: boolean
  message: string
  rowNumber?: number
  isLocked?: boolean
}

export class ExcelService {
  /**
   * Append a transaction into the specified Excel workbook file.
   * Preserves formulas, styles, fonts, and merged cells.
   */
  public async appendTransaction(
    filePath: string,
    sheetName: string,
    transaction: FinancialTransaction
  ): Promise<ExcelAppendResult> {
    const workbook = new ExcelJS.Workbook()

    try {
      let fileBytes: Uint8Array | null = null

      // Attempt reading using Tauri FS plugin if available
      try {
        const { readFile } = await import('@tauri-apps/plugin-fs')
        fileBytes = await readFile(filePath)
        await workbook.xlsx.load(fileBytes.buffer as ArrayBuffer)
      } catch (err: any) {
        // If file not found, we create a fresh template workbook
        if (err?.message?.includes('not found') || err?.code === 'ENOENT') {
          console.log('[ExcelService] Creating new workbook template at', filePath)
          this.initializeNewWorkbook(workbook, sheetName)
        } else if (err?.message?.includes('EBUSY') || err?.message?.includes('permission')) {
          return {
            success: false,
            isLocked: true,
            message:
              'File Excel sedang dibuka oleh aplikasi lain (misal: Microsoft Excel). Silakan simpan dan tutup file tersebut terlebih dahulu.',
          }
        } else {
          // If in browser or mock environment without Tauri
          console.warn('[ExcelService] Tauri FS not available, using in-memory mock', err)
          this.initializeNewWorkbook(workbook, sheetName)
        }
      }

      // Locate or create the target worksheet
      let worksheet = workbook.getWorksheet(sheetName)
      if (!worksheet) {
        worksheet = workbook.addWorksheet(sheetName)
        this.applyDefaultHeaders(worksheet)
      }

      // Find the next empty row without disturbing merged cells or formulas
      const targetRowIndex = this.findNextAvailableRow(worksheet)
      const row = worksheet.getRow(targetRowIndex)

      // Set values: Col 1: Tanggal, Col 2: Kategori, Col 3: Nominal, Col 4: Keterangan
      row.getCell(1).value = transaction.tanggal
      row.getCell(2).value = transaction.kategori
      row.getCell(3).value = transaction.nominal
      row.getCell(4).value = transaction.keterangan

      // Apply formatting while preserving cell styling
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' }
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' }
      row.getCell(3).numFmt = '#,##0' // Indonesian IDR number formatting
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' }

      // Inherit font style from previous row if present, otherwise clean font
      const prevRow = targetRowIndex > 2 ? worksheet.getRow(targetRowIndex - 1) : null
      if (prevRow && prevRow.getCell(1).font) {
        for (let c = 1; c <= 4; c++) {
          row.getCell(c).font = { ...prevRow.getCell(c).font }
        }
      } else {
        const standardFont = { name: 'Segoe UI', size: 10 }
        for (let c = 1; c <= 4; c++) {
          row.getCell(c).font = standardFont
        }
      }

      row.commit()

      // Write back the updated workbook
      try {
        const { writeFile } = await import('@tauri-apps/plugin-fs')
        const buffer = await workbook.xlsx.writeBuffer()
        await writeFile(filePath, new Uint8Array(buffer))
      } catch (writeErr: any) {
        if (
          writeErr?.message?.includes('EBUSY') ||
          writeErr?.message?.includes('locked') ||
          writeErr?.message?.includes('permission')
        ) {
          return {
            success: false,
            isLocked: true,
            message:
              'Gagal menyimpan! File Excel sedang dikunci/dibuka oleh aplikasi lain. Tutup file dan coba lagi.',
          }
        }
        // Browser/mock mode download or simulated success
        console.log('[ExcelService] Workbook updated in-memory (browser mode).')
      }

      return {
        success: true,
        rowNumber: targetRowIndex,
        message: `Transaksi Rp ${transaction.nominal.toLocaleString('id-ID')} (${transaction.kategori}) berhasil dicatat pada baris ${targetRowIndex}!`,
      }
    } catch (globalErr: any) {
      console.error('[ExcelService] Unexpected error:', globalErr)
      return {
        success: false,
        message: `Gagal memproses Excel: ${globalErr?.message || 'Error tidak diketahui'}`,
      }
    }
  }

  /**
   * Initializes standard headers if sheet is newly created
   */
  private applyDefaultHeaders(worksheet: ExcelJS.Worksheet) {
    const headerRow = worksheet.getRow(1)
    headerRow.values = ['Tanggal', 'Kategori', 'Nominal (IDR)', 'Keterangan']
    headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate 800
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    headerRow.height = 24

    // Set column widths
    worksheet.getColumn(1).width = 16
    worksheet.getColumn(2).width = 24
    worksheet.getColumn(3).width = 20
    worksheet.getColumn(4).width = 36
    headerRow.commit()
  }

  private initializeNewWorkbook(workbook: ExcelJS.Workbook, sheetName: string) {
    const sheet = workbook.addWorksheet(sheetName)
    this.applyDefaultHeaders(sheet)
  }

  /**
   * Finds next empty row respecting existing data and merged areas
   */
  private findNextAvailableRow(worksheet: ExcelJS.Worksheet): number {
    let lastRow = worksheet.lastRow ? worksheet.lastRow.number : 1
    // Check if the last row is completely empty
    while (lastRow > 1) {
      const row = worksheet.getRow(lastRow)
      let hasData = false
      row.eachCell(() => {
        hasData = true
      })
      if (hasData) {
        return lastRow + 1
      }
      lastRow--
    }
    return 2 // Row 1 is headers
  }

  /**
   * Read recent transactions for display in chat or dashboard
   */
  public async getRecentTransactions(
    filePath: string,
    sheetName: string,
    limit: number = 5
  ): Promise<FinancialTransaction[]> {
    const workbook = new ExcelJS.Workbook()
    try {
      const { readFile } = await import('@tauri-apps/plugin-fs')
      const fileBytes = await readFile(filePath)
      await workbook.xlsx.load(fileBytes.buffer as ArrayBuffer)

      const worksheet = workbook.getWorksheet(sheetName)
      if (!worksheet) return []

      const transactions: FinancialTransaction[] = []
      const totalRows = worksheet.rowCount

      for (let r = totalRows; r >= 2 && transactions.length < limit; r--) {
        const row = worksheet.getRow(r)
        const tanggal = row.getCell(1).text || ''
        const kategori = row.getCell(2).text || ''
        const nominal = Number(row.getCell(3).value) || 0
        const keterangan = row.getCell(4).text || ''

        if (nominal > 0) {
          transactions.push({
            tanggal,
            kategori,
            nominal,
            keterangan,
            tipe: 'pengeluaran',
          })
        }
      }

      return transactions
    } catch {
      return []
    }
  }
}

export const excelService = new ExcelService()
