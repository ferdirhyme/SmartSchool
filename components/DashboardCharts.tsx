
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend
} from 'recharts';

interface ChartProps {
  data: any[];
  title: string;
  height?: number;
}

export const EnrollmentChart: React.FC<ChartProps> = ({ data, title, height = 300 }) => (
  <div className="w-full">
    <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">{title}</h4>
    <div style={{ width: '100%', height: `${height}px` }}>
      <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
            cursor={{ fill: '#f3f4f6', opacity: 0.4 }}
          />
          <Bar dataKey="students" fill="#4F46E5" radius={[4, 4, 0, 0]} barSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export const AttendanceDonutChart: React.FC<{ data: { name: string, value: number, color: string }[], title: string, height?: number }> = ({ data, title, height = 300 }) => (
  <div className="w-full">
    <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">{title}</h4>
    <div style={{ width: '100%', height: `${height}px` }}>
      <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
          />
          <Legend verticalAlign="bottom" height={36}/>
        </PieChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export const FinancialGrowthChart: React.FC<ChartProps> = ({ data, title, height = 300 }) => (
  <div className="w-full">
    <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">{title}</h4>
    <div style={{ width: '100%', height: `${height}px` }}>
      <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#10B981" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export const PerformanceLineChart: React.FC<ChartProps> = ({ data, title, height = 300 }) => (
  <div className="w-full">
    <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-wider">{title}</h4>
    <div style={{ width: '100%', height: `${height}px` }}>
      <ResponsiveContainer minWidth={0} minHeight={0} debounce={50}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
          />
          <Line type="monotone" dataKey="score" stroke="#4F46E5" strokeWidth={4} dot={{ r: 6, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);
