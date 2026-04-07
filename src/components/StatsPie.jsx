import React from 'react';
import { PieChart, Pie, Cell, Sector, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * Reusable pie chart wrapper that disables the active shape expansion on click.
 * Props:
 *   data        - array of { name, value, color? }
 *   colors      - array of color strings (parallel to data)
 *   height      - chart height (default 250)
 *   innerRadius - (default 50)
 *   outerRadius - (default 90)
 *   tooltip     - Tooltip element or props (optional)
 */
const StatsPie = ({
  data,
  colors,
  height = 250,
  innerRadius = 50,
  outerRadius = 90,
  tooltipFormatter,
  tooltipStyle = {},
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        paddingAngle={3}
        dataKey="value"
        strokeWidth={0}
        activeShape={(props) => <Sector {...props} outerRadius={props.outerRadius} />}
      >
        {data.map((_, idx) => (
          <Cell key={idx} fill={colors[idx % colors.length]} />
        ))}
      </Pie>
      {tooltipFormatter && (
        <Tooltip
          formatter={tooltipFormatter}
          cursor={false}
          {...tooltipStyle}
        />
      )}
    </PieChart>
  </ResponsiveContainer>
);

export default StatsPie;
