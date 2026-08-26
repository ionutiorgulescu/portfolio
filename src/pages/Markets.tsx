import Market from '../components/Market/Market';
import { color } from '../theme/cssVars';

const Markets = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold" style={{ color: color.textStrong }}>
        Markets
      </h1>
      <Market />
    </div>
  );
};

export default Markets;

