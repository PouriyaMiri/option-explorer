import { useEffect, useState } from 'react';

const Timer = ({ onTick }) => {
  const [startTime] = useState(Date.now());
  const [time, setTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTime(elapsed);
      onTick?.(elapsed); // send to parent
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, onTick]);

  return <div className="mt-4">Time: {time} seconds</div>;
};

export default Timer;
