
import React from 'react';
import { Student, FeeType } from '../../types.ts';
import { ReportHeader } from './ReportHeader.tsx';
import { ReportFooter } from './ReportFooter.tsx';

interface Defaulter extends Student {
    amount_paid: number;
    amount_due: number;
    class: { name: string } | null;
}

interface ReportData {
    defaulters: Defaulter[];
    feeType: FeeType;
}

export const FeeDefaultersReport: React.FC<{ data: ReportData }> = ({ data }) => {
    const { defaulters, feeType } = data;
    
    return (
        <div className="flex flex-col p-4 bg-gray-50 text-gray-900">
            <main className="flex-grow">
                <ReportHeader />
                <h2 className="text-center text-2xl font-bold my-4 text-[#722F37]">Fee Defaulters List</h2>
                <div className="text-center mb-8">
                    <p><strong>Fee Type:</strong> {feeType.name}</p>
                    <p><strong>Total Due:</strong> GHS {feeType.default_amount?.toFixed(2)}</p>
                </div>

                <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse border border-gray-400 min-w-[600px]">
                    <thead className="bg-gray-100 text-[#722F37]">
                        <tr>
                            <th className="border p-2">#</th>
                            <th className="border p-2">Admission No.</th>
                            <th className="border p-2">Student Name</th>
                            <th className="border p-2">Class</th>
                            <th className="border p-2 text-right">Amount Paid (GHS)</th>
                            <th className="border p-2 text-right">Amount Due (GHS)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {defaulters.map((d, index) => (
                            <tr key={d.id}>
                                <td className="border p-2">{index + 1}</td>
                                <td className="border p-2">{d.admission_number}</td>
                                <td className="border p-2">{d.full_name}</td>
                                <td className="border p-2">{d.class?.name || 'N/A'}</td>
                                <td className="border p-2 text-right">{d.amount_paid.toFixed(2)}</td>
                                <td className="border p-2 text-right font-bold">{d.amount_due.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
                {defaulters.length === 0 && <p className="text-center p-4">No defaulters found for this fee type.</p>}
            </main>
            <ReportFooter />
        </div>
    );
};
