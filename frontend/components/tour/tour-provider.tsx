'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { pageTours, type TourStep, type PageTour } from '@/lib/tour-steps';

const STORAGE_KEY_COMPLETED = 'credentis_tour_completed';
const STORAGE_KEY_PAGES = 'credentis_tour_completed_pages';

interface TourContextValue {
  isActive: boolean;
  currentStep: TourStep | null;
  currentStepIndex: number;
  totalSteps: number;
  currentPageTour: PageTour | null;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  startTour: (page?: string) => void;
  startFullTour: () => void;
  hasCompletedTour: boolean;
}

const TourContext = createContext<TourContextValue>({
  isActive: false,
  currentStep: null,
  currentStepIndex: 0,
  totalSteps: 0,
  currentPageTour: null,
  nextStep: () => {},
  prevStep: () => {},
  skipTour: () => {},
  startTour: () => {},
  startFullTour: () => {},
  hasCompletedTour: false,
});

export function useTour() {
  return useContext(TourContext);
}

export function TourProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(false);
  const [isFullTour, setIsFullTour] = useState(false);

  // Find the tour for the current page
  const currentPageTour = pageTours.find((t) => t.route === pathname) || null;
  const steps = currentPageTour?.steps || [];
  const currentStep = isActive && steps[currentStepIndex] ? steps[currentStepIndex] : null;

  // Load completion state from localStorage
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY_COMPLETED);
    setHasCompletedTour(completed === 'true');
  }, []);

  // Auto-start tour on first visit to /dashboard
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY_COMPLETED);
    if (!completed && pathname === '/dashboard') {
      const timer = setTimeout(() => {
        setIsActive(true);
        setCurrentStepIndex(0);
        setIsFullTour(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When navigating during a full tour, auto-continue on the new page
  useEffect(() => {
    if (isFullTour && currentPageTour && !isActive) {
      const timer = setTimeout(() => {
        setIsActive(true);
        setCurrentStepIndex(0);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [pathname, isFullTour, currentPageTour]); // eslint-disable-line react-hooks/exhaustive-deps

  const markPageCompleted = useCallback((route: string) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PAGES);
      const pages: string[] = raw ? JSON.parse(raw) : [];
      if (!pages.includes(route)) {
        pages.push(route);
        localStorage.setItem(STORAGE_KEY_PAGES, JSON.stringify(pages));
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  const markTourCompleted = useCallback(() => {
    localStorage.setItem(STORAGE_KEY_COMPLETED, 'true');
    setHasCompletedTour(true);
  }, []);

  const nextStep = useCallback(() => {
    if (!currentPageTour) return;

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((i) => i + 1);
    } else {
      // Last step on this page
      markPageCompleted(currentPageTour.route);
      setIsActive(false);

      if (currentPageTour.nextPageRoute && isFullTour) {
        // Navigate to next page — the useEffect above will auto-start
        router.push(currentPageTour.nextPageRoute);
      } else {
        // Tour is finished
        setIsFullTour(false);
        markTourCompleted();
      }
    }
  }, [currentStepIndex, steps.length, currentPageTour, isFullTour, router, markPageCompleted, markTourCompleted]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => i - 1);
    }
  }, [currentStepIndex]);

  const skipTour = useCallback(() => {
    setIsActive(false);
    setIsFullTour(false);
    markTourCompleted();
  }, [markTourCompleted]);

  const startTour = useCallback(
    (page?: string) => {
      const targetPage = page || pathname;
      if (targetPage !== pathname) {
        router.push(targetPage);
      }
      setCurrentStepIndex(0);
      setIsActive(true);
    },
    [pathname, router],
  );

  const startFullTour = useCallback(() => {
    // Clear completion state
    localStorage.removeItem(STORAGE_KEY_COMPLETED);
    localStorage.removeItem(STORAGE_KEY_PAGES);
    setHasCompletedTour(false);
    setIsFullTour(true);
    setCurrentStepIndex(0);

    if (pathname !== '/dashboard') {
      router.push('/dashboard');
      // The useEffect will auto-start when we land on /dashboard
    } else {
      setIsActive(true);
    }
  }, [pathname, router]);

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStep,
        currentStepIndex,
        totalSteps: steps.length,
        currentPageTour,
        nextStep,
        prevStep,
        skipTour,
        startTour,
        startFullTour,
        hasCompletedTour,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}
