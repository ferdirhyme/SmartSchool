
import React from 'react';
import { Student, FeePayment } from '../../types.ts';
import { ReportHeader } from './ReportHeader.tsx';
import { ReportFooter } from './ReportFooter.tsx';

interface ReportData {
    student: Student & { class: { name: string } | null };
    payments: (FeePayment & {fee_type: {name: string}})[];
}

export const PaymentHistoryReport: React.FC<{ data: ReportData }> = ({ data }) => {
    const { student, payments } = data;
    
    const totalPaid = payments.reduce((sum, p) => sum + p.amount_paid, 0);

    return (
        <div className="flex flex-col p-4 bg-gray-50 text-gray-900">
            <main className="flex-grow">
                <ReportHeader />
                <h2 className="text-center text-2xl font-bold my-4 text-[#722F37]">Student Payment History</h2>
                <div className="mb-8 p-4 border border-gray-300 rounded-md">
                    <p><strong>Student:</strong> {student.full_name}</p>
                    <p><strong>Admission No:</strong> {student.admission_number}</p>
                    <p><strong>Class:</strong> {student.class?.name}</p>
                </div>

                <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse border border-gray-400 min-w-[500px]">
                    <thead className="bg-gray-100 text-[#722F37]">
                        <tr>
                            <th className="border p-2">Date</th>
                            <th className="border p-2">Receipt No.</th>
                            <th className="border p-2">Fee Type</th>
                            <th className="border p-2">Method</th>
                            <th className="border p-2 text-right">Amount Paid (GHS)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {payments.map((p) => (
                            <tr key={p.id}>
                                <td className="border p-2">{p.payment_date}</td>
                                <td className="border p-2">{p.receipt_number}</td>
                                <td className="border p-2">{p.fee_type.name}</td>
                                <td className="border p-2">{p.payment_method}</td>
                                <td className="border p-2 text-right">{p.amount_paid.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="font-bold bg-gray-100">
                            <td colSpan={4} className="border p-2 text-right">Total Paid:</td>
                            <td className="border p-2 text-right">GHS {totalPaid.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                </div>
                {payments.length === 0 && <p className="text-center p-4">No payment history found for this student.</p>}
            </main>
            <ReportFooter />
        </div>
    );
};
