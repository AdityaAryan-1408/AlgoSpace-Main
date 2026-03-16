import type { CardSource, TopicDomain } from "@/types";

export type Difficulty = "easy" | "medium" | "hard";
export type CardType = "leetcode" | "cs";

export interface CardSolution {
  name: string;
  content: string;
}

export interface RelatedProblem {
  title: string;
  url?: string;
}

export interface Flashcard {
  id: string;
  type: CardType;
  title: string;
  description: string;
  url?: string;
  notes: string;
  solution?: string;
  solutions?: CardSolution[];
  timeComplexity?: string;
  spaceComplexity?: string;
  relatedProblems?: RelatedProblem[];
  difficulty: Difficulty;
  tags: string[];
  // New fields for AlgoTrack expansion
  source: CardSource;
  solvedAt?: string;        // ISO timestamp
  topicDomain?: TopicDomain;
  topicIds: string[];
  metadata: Record<string, unknown>;
  // Existing review/SRS fields
  lastReview: string;
  lastRating: "EASY" | "GOOD" | "HARD" | "AGAIN";
  nextReview: string;
  dueInDays: number;
  history: { good: number; total: number };
}

export const mockCards: Flashcard[] = [
  {
    id: "1",
    type: "leetcode",
    title: "Grumpy Bookstore Owner",
    description: "There is a bookstore owner that has a store open for n minutes. Every minute, some number of customers enter the store. You are given an integer array customers of length n where customers[i] is the number of the customer that enters the store at the start of the ith minute and all those customers leave after the end of that minute.\n\nOn some minutes, the bookstore owner is grumpy. You are given a binary array grumpy where grumpy[i] is 1 if the bookstore owner is grumpy during the ith minute, and is 0 otherwise.\n\nWhen the bookstore owner is grumpy, the customers of that minute are not satisfied, otherwise, they are satisfied.\n\nThe bookstore owner knows a secret technique to keep themselves not grumpy for minutes consecutive minutes, but can only use it once.\n\nReturn the maximum number of customers that can be satisfied throughout the day.",
    url: "https://leetcode.com/problems/grumpy-bookstore-owner/",
    notes: "Use a sliding window of size `minutes` to find the maximum additional satisfied customers we can get by keeping the owner not grumpy.",
    solution: "```python\nclass Solution:\n    def maxSatisfied(self, customers: List[int], grumpy: List[int], minutes: int) -> int:\n        # Calculate initially satisfied customers\n        satisfied = sum(c for c, g in zip(customers, grumpy) if g == 0)\n        \n        # Sliding window for additional satisfied customers\n        max_additional = 0\n        current_additional = 0\n        \n        for i in range(len(customers)):\n            if grumpy[i] == 1:\n                current_additional += customers[i]\n            \n            if i >= minutes and grumpy[i - minutes] == 1:\n                current_additional -= customers[i - minutes]\n                \n            max_additional = max(max_additional, current_additional)\n            \n        return satisfied + max_additional\n```",
    difficulty: "medium",
    tags: ["Sliding Window"],
    source: "seed",
    topicDomain: "dsa",
    topicIds: ["dsa.sliding-window"],
    metadata: {},
    lastReview: "Feb 25, 2026",
    lastRating: "GOOD",
    nextReview: "Mar 3, 2026",
    dueInDays: 6,
    history: { good: 1, total: 1 },
  },
  {
    id: "2",
    type: "leetcode",
    title: "Maximum Average Subarray I",
    description: "You are given an integer array nums consisting of n elements, and an integer k.\n\nFind a contiguous subarray whose length is equal to k that has the maximum average value and return this value. Any answer with a calculation error less than 10-5 will be accepted.",
    url: "https://leetcode.com/problems/maximum-average-subarray-i/",
    notes: "Classic fixed-size sliding window. Keep track of the sum of the current window of size k. Slide by adding the new element and subtracting the element that left the window.",
    solution: "```python\nclass Solution:\n    def findMaxAverage(self, nums: List[int], k: int) -> float:\n        curr_sum = sum(nums[:k])\n        max_sum = curr_sum\n        \n        for i in range(k, len(nums)):\n            curr_sum += nums[i] - nums[i-k]\n            max_sum = max(max_sum, curr_sum)\n            \n        return max_sum / k\n```",
    difficulty: "medium",
    tags: ["Array", "Sliding Window"],
    source: "seed",
    topicDomain: "dsa",
    topicIds: ["dsa.arrays", "dsa.sliding-window"],
    metadata: {},
    lastReview: "Feb 25, 2026",
    lastRating: "EASY",
    nextReview: "Mar 7, 2026",
    dueInDays: 10,
    history: { good: 1, total: 1 },
  },
  {
    id: "cs-1",
    type: "cs",
    title: "ACID Properties (DBMS)",
    description: "ACID is a set of properties of database transactions intended to guarantee data validity despite errors, power failures, and other mishaps.\n\n- **Atomicity:** Transactions are all or nothing.\n- **Consistency:** Only valid data is saved.\n- **Isolation:** Transactions do not affect each other.\n- **Durability:** Written data will not be lost.",
    notes: "Remember the bank transfer example: deducting from Account A and adding to Account B must be Atomic. If the system crashes in between, the transaction must rollback.",
    difficulty: "medium",
    tags: ["Database", "Transactions"],
    source: "seed",
    topicDomain: "cs",
    topicIds: ["cs.database.acid"],
    metadata: {},
    lastReview: "Feb 24, 2026",
    lastRating: "GOOD",
    nextReview: "Mar 5, 2026",
    dueInDays: 8,
    history: { good: 3, total: 4 },
  },
  {
    id: "cs-2",
    type: "cs",
    title: "Virtual Memory & Paging",
    description: "Virtual memory is a memory management technique that provides an idealized abstraction of the storage resources that are actually available on a given machine which creates the illusion to users of a very large (main) memory.\n\nPaging is a memory management scheme by which a computer stores and retrieves data from secondary storage for use in main memory. In this scheme, the operating system retrieves data from secondary storage in same-size blocks called pages.",
    notes: "Key concepts: Page Table, TLB (Translation Lookaside Buffer), Page Faults. TLB is a hardware cache for the page table to speed up virtual-to-physical address translation.",
    difficulty: "hard",
    tags: ["OS", "Memory"],
    source: "seed",
    topicDomain: "cs",
    topicIds: ["cs.os.virtual-memory", "cs.os.paging"],
    metadata: {},
    lastReview: "Feb 20, 2026",
    lastRating: "HARD",
    nextReview: "Feb 26, 2026",
    dueInDays: 1,
    history: { good: 1, total: 3 },
  },
  {
    id: "5",
    type: "leetcode",
    title: "Minimum Recolors to Get K Consecutive Black Blocks",
    description: "You are given a 0-indexed string blocks of length n, where blocks[i] is either 'W' or 'B', representing the color of the ith block. The characters 'W' and 'B' denote the colors white and black, respectively.\n\nYou are also given an integer k, which is the desired number of consecutive black blocks.\n\nIn one operation, you can recolor a white block such that it becomes a black block.\n\nReturn the minimum number of operations needed such that there is at least one occurrence of k consecutive black blocks.",
    url: "https://leetcode.com/problems/minimum-recolors-to-get-k-consecutive-black-blocks/",
    notes: "Fixed sliding window of size k. Count the number of 'W's in the window. The minimum number of 'W's across all windows of size k is the answer.",
    solution: "```python\nclass Solution:\n    def minimumRecolors(self, blocks: str, k: int) -> int:\n        # Count 'W's in the first window\n        min_ops = blocks[:k].count('W')\n        curr_ops = min_ops\n        \n        for i in range(k, len(blocks)):\n            if blocks[i] == 'W':\n                curr_ops += 1\n            if blocks[i-k] == 'W':\n                curr_ops -= 1\n                \n            min_ops = min(min_ops, curr_ops)\n            \n        return min_ops\n```",
    difficulty: "easy",
    tags: ["Sliding Window", "String"],
    source: "seed",
    topicDomain: "dsa",
    topicIds: ["dsa.sliding-window", "dsa.strings"],
    metadata: {},
    lastReview: "Feb 25, 2026",
    lastRating: "EASY",
    nextReview: "Mar 7, 2026",
    dueInDays: 10,
    history: { good: 1, total: 1 },
  }
];
