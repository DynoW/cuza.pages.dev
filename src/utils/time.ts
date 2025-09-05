/**
 * Date and time utilities for countdown functionality
 */

export interface TimeDifference {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export const calculateTimeDifference = (targetTime: number, currentTime: number = Date.now()): TimeDifference => {
  const distance = targetTime - currentTime;
  
  if (distance <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds };
};

export const calculateProgress = (startTime: number, endTime: number, currentTime: number = Date.now()): number => {
  if (currentTime <= startTime) return 0;
  if (currentTime >= endTime) return 100;
  
  const totalDuration = endTime - startTime;
  const elapsed = currentTime - startTime;
  
  return Math.round((elapsed / totalDuration) * 100);
};

export const padNumber = (num: number): string => 
  num < 10 ? `0${num}` : num.toString();
