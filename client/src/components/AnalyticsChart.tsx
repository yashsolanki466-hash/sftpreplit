import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Mock data generator for visualization
const data = [
  { name: 'Jan', transfers: 40 },
  { name: 'Feb', transfers: 30 },
  { name: 'Mar', transfers: 20 },
  { name: 'Apr', transfers: 27 },
  { name: 'May', transfers: 18 },
  { name: 'Jun', transfers: 23 },
  { name: 'Jul', transfers: 34 },
];

const COLORS = ['hsl(var(--primary))', '#8884d8', '#82ca9d', '#ffc658'];

export function AnalyticsChart() {
  return (
    <Card className="h-full shadow-lg shadow-black/5 border-border/60">
      <CardHeader>
        <CardTitle className="text-lg font-display">Transfer Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
              />
              <Tooltip 
                cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))', 
                  borderColor: 'hsl(var(--border))',
                  borderRadius: 'var(--radius)',
                  boxShadow: 'var(--shadow-md)'
                }}
              />
              <Bar dataKey="transfers" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill="hsl(var(--primary))" fillOpacity={0.8 + (index % 3) * 0.1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
