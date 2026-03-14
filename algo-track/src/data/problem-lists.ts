/**
 * Curated problem lists for bulk import.
 * Each problem has a title, URL, difficulty, and tags.
 */

export interface ProblemListItem {
    title: string;
    url: string;
    difficulty: "easy" | "medium" | "hard";
    tags: string[];
}

export interface ProblemList {
    id: string;
    name: string;
    description: string;
    count: number;
    problems: ProblemListItem[];
}

export const PROBLEM_LISTS: ProblemList[] = [
    {
        id: "blind-75",
        name: "Blind 75",
        description: "The original 75 LeetCode problems curated by Yangshun, covering all key patterns for technical interviews.",
        count: 75,
        problems: [
            // Array & Hashing
            { title: "Two Sum", url: "https://leetcode.com/problems/two-sum/", difficulty: "easy", tags: ["Array", "Hash Table"] },
            { title: "Contains Duplicate", url: "https://leetcode.com/problems/contains-duplicate/", difficulty: "easy", tags: ["Array", "Hash Table"] },
            { title: "Valid Anagram", url: "https://leetcode.com/problems/valid-anagram/", difficulty: "easy", tags: ["Hash Table", "String"] },
            { title: "Group Anagrams", url: "https://leetcode.com/problems/group-anagrams/", difficulty: "medium", tags: ["Hash Table", "String"] },
            { title: "Top K Frequent Elements", url: "https://leetcode.com/problems/top-k-frequent-elements/", difficulty: "medium", tags: ["Array", "Hash Table", "Heap"] },
            { title: "Product of Array Except Self", url: "https://leetcode.com/problems/product-of-array-except-self/", difficulty: "medium", tags: ["Array", "Prefix Sum"] },
            { title: "Encode and Decode Strings", url: "https://leetcode.com/problems/encode-and-decode-strings/", difficulty: "medium", tags: ["String", "Design"] },
            { title: "Longest Consecutive Sequence", url: "https://leetcode.com/problems/longest-consecutive-sequence/", difficulty: "medium", tags: ["Array", "Hash Table"] },
            // Two Pointers
            { title: "Valid Palindrome", url: "https://leetcode.com/problems/valid-palindrome/", difficulty: "easy", tags: ["Two Pointers", "String"] },
            { title: "3Sum", url: "https://leetcode.com/problems/3sum/", difficulty: "medium", tags: ["Array", "Two Pointers"] },
            { title: "Container With Most Water", url: "https://leetcode.com/problems/container-with-most-water/", difficulty: "medium", tags: ["Array", "Two Pointers"] },
            // Sliding Window
            { title: "Best Time to Buy and Sell Stock", url: "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/", difficulty: "easy", tags: ["Array", "Sliding Window"] },
            { title: "Longest Substring Without Repeating Characters", url: "https://leetcode.com/problems/longest-substring-without-repeating-characters/", difficulty: "medium", tags: ["String", "Sliding Window"] },
            { title: "Longest Repeating Character Replacement", url: "https://leetcode.com/problems/longest-repeating-character-replacement/", difficulty: "medium", tags: ["String", "Sliding Window"] },
            { title: "Minimum Window Substring", url: "https://leetcode.com/problems/minimum-window-substring/", difficulty: "hard", tags: ["String", "Sliding Window"] },
            // Stack
            { title: "Valid Parentheses", url: "https://leetcode.com/problems/valid-parentheses/", difficulty: "easy", tags: ["String", "Stack"] },
            // Binary Search
            { title: "Search in Rotated Sorted Array", url: "https://leetcode.com/problems/search-in-rotated-sorted-array/", difficulty: "medium", tags: ["Array", "Binary Search"] },
            { title: "Find Minimum in Rotated Sorted Array", url: "https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/", difficulty: "medium", tags: ["Array", "Binary Search"] },
            // Linked List
            { title: "Reverse Linked List", url: "https://leetcode.com/problems/reverse-linked-list/", difficulty: "easy", tags: ["Linked List"] },
            { title: "Merge Two Sorted Lists", url: "https://leetcode.com/problems/merge-two-sorted-lists/", difficulty: "easy", tags: ["Linked List"] },
            { title: "Linked List Cycle", url: "https://leetcode.com/problems/linked-list-cycle/", difficulty: "easy", tags: ["Linked List", "Two Pointers"] },
            { title: "Reorder List", url: "https://leetcode.com/problems/reorder-list/", difficulty: "medium", tags: ["Linked List"] },
            { title: "Remove Nth Node From End of List", url: "https://leetcode.com/problems/remove-nth-node-from-end-of-list/", difficulty: "medium", tags: ["Linked List", "Two Pointers"] },
            { title: "Merge K Sorted Lists", url: "https://leetcode.com/problems/merge-k-sorted-lists/", difficulty: "hard", tags: ["Linked List", "Heap"] },
            // Trees
            { title: "Invert Binary Tree", url: "https://leetcode.com/problems/invert-binary-tree/", difficulty: "easy", tags: ["Tree", "BFS", "DFS"] },
            { title: "Maximum Depth of Binary Tree", url: "https://leetcode.com/problems/maximum-depth-of-binary-tree/", difficulty: "easy", tags: ["Tree", "DFS"] },
            { title: "Same Tree", url: "https://leetcode.com/problems/same-tree/", difficulty: "easy", tags: ["Tree", "DFS"] },
            { title: "Subtree of Another Tree", url: "https://leetcode.com/problems/subtree-of-another-tree/", difficulty: "easy", tags: ["Tree", "DFS"] },
            { title: "Lowest Common Ancestor of a BST", url: "https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/", difficulty: "medium", tags: ["Tree", "BST"] },
            { title: "Binary Tree Level Order Traversal", url: "https://leetcode.com/problems/binary-tree-level-order-traversal/", difficulty: "medium", tags: ["Tree", "BFS"] },
            { title: "Validate Binary Search Tree", url: "https://leetcode.com/problems/validate-binary-search-tree/", difficulty: "medium", tags: ["Tree", "BST", "DFS"] },
            { title: "Kth Smallest Element in a BST", url: "https://leetcode.com/problems/kth-smallest-element-in-a-bst/", difficulty: "medium", tags: ["Tree", "BST"] },
            { title: "Construct Binary Tree from Preorder and Inorder Traversal", url: "https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/", difficulty: "medium", tags: ["Tree", "DFS"] },
            { title: "Binary Tree Maximum Path Sum", url: "https://leetcode.com/problems/binary-tree-maximum-path-sum/", difficulty: "hard", tags: ["Tree", "DFS"] },
            { title: "Serialize and Deserialize Binary Tree", url: "https://leetcode.com/problems/serialize-and-deserialize-binary-tree/", difficulty: "hard", tags: ["Tree", "BFS", "DFS"] },
            // Heap / Priority Queue
            { title: "Find Median from Data Stream", url: "https://leetcode.com/problems/find-median-from-data-stream/", difficulty: "hard", tags: ["Heap", "Design"] },
            // Tries
            { title: "Implement Trie (Prefix Tree)", url: "https://leetcode.com/problems/implement-trie-prefix-tree/", difficulty: "medium", tags: ["Trie", "Design"] },
            { title: "Design Add and Search Words Data Structure", url: "https://leetcode.com/problems/design-add-and-search-words-data-structure/", difficulty: "medium", tags: ["Trie", "DFS"] },
            { title: "Word Search II", url: "https://leetcode.com/problems/word-search-ii/", difficulty: "hard", tags: ["Trie", "Backtracking"] },
            // Graphs
            { title: "Number of Islands", url: "https://leetcode.com/problems/number-of-islands/", difficulty: "medium", tags: ["Graph", "BFS", "DFS"] },
            { title: "Clone Graph", url: "https://leetcode.com/problems/clone-graph/", difficulty: "medium", tags: ["Graph", "BFS", "DFS"] },
            { title: "Pacific Atlantic Water Flow", url: "https://leetcode.com/problems/pacific-atlantic-water-flow/", difficulty: "medium", tags: ["Graph", "DFS"] },
            { title: "Course Schedule", url: "https://leetcode.com/problems/course-schedule/", difficulty: "medium", tags: ["Graph", "Topological Sort"] },
            { title: "Number of Connected Components in an Undirected Graph", url: "https://leetcode.com/problems/number-of-connected-components-in-an-undirected-graph/", difficulty: "medium", tags: ["Graph", "Union Find"] },
            { title: "Graph Valid Tree", url: "https://leetcode.com/problems/graph-valid-tree/", difficulty: "medium", tags: ["Graph", "Union Find"] },
            // Dynamic Programming
            { title: "Climbing Stairs", url: "https://leetcode.com/problems/climbing-stairs/", difficulty: "easy", tags: ["DP"] },
            { title: "House Robber", url: "https://leetcode.com/problems/house-robber/", difficulty: "medium", tags: ["DP"] },
            { title: "House Robber II", url: "https://leetcode.com/problems/house-robber-ii/", difficulty: "medium", tags: ["DP"] },
            { title: "Longest Palindromic Substring", url: "https://leetcode.com/problems/longest-palindromic-substring/", difficulty: "medium", tags: ["DP", "String"] },
            { title: "Palindromic Substrings", url: "https://leetcode.com/problems/palindromic-substrings/", difficulty: "medium", tags: ["DP", "String"] },
            { title: "Decode Ways", url: "https://leetcode.com/problems/decode-ways/", difficulty: "medium", tags: ["DP", "String"] },
            { title: "Coin Change", url: "https://leetcode.com/problems/coin-change/", difficulty: "medium", tags: ["DP"] },
            { title: "Maximum Product Subarray", url: "https://leetcode.com/problems/maximum-product-subarray/", difficulty: "medium", tags: ["DP", "Array"] },
            { title: "Word Break", url: "https://leetcode.com/problems/word-break/", difficulty: "medium", tags: ["DP", "String"] },
            { title: "Longest Increasing Subsequence", url: "https://leetcode.com/problems/longest-increasing-subsequence/", difficulty: "medium", tags: ["DP", "Binary Search"] },
            { title: "Unique Paths", url: "https://leetcode.com/problems/unique-paths/", difficulty: "medium", tags: ["DP", "Math"] },
            { title: "Jump Game", url: "https://leetcode.com/problems/jump-game/", difficulty: "medium", tags: ["DP", "Greedy"] },
            { title: "Combination Sum IV", url: "https://leetcode.com/problems/combination-sum-iv/", difficulty: "medium", tags: ["DP"] },
            // Greedy
            { title: "Maximum Subarray", url: "https://leetcode.com/problems/maximum-subarray/", difficulty: "medium", tags: ["Array", "Greedy", "DP"] },
            // Intervals
            { title: "Insert Interval", url: "https://leetcode.com/problems/insert-interval/", difficulty: "medium", tags: ["Array", "Intervals"] },
            { title: "Merge Intervals", url: "https://leetcode.com/problems/merge-intervals/", difficulty: "medium", tags: ["Array", "Intervals"] },
            { title: "Non-overlapping Intervals", url: "https://leetcode.com/problems/non-overlapping-intervals/", difficulty: "medium", tags: ["Array", "Intervals", "Greedy"] },
            { title: "Meeting Rooms", url: "https://leetcode.com/problems/meeting-rooms/", difficulty: "easy", tags: ["Array", "Intervals"] },
            { title: "Meeting Rooms II", url: "https://leetcode.com/problems/meeting-rooms-ii/", difficulty: "medium", tags: ["Array", "Intervals", "Heap"] },
            // Math & Geometry
            { title: "Rotate Image", url: "https://leetcode.com/problems/rotate-image/", difficulty: "medium", tags: ["Array", "Matrix"] },
            { title: "Spiral Matrix", url: "https://leetcode.com/problems/spiral-matrix/", difficulty: "medium", tags: ["Array", "Matrix"] },
            { title: "Set Matrix Zeroes", url: "https://leetcode.com/problems/set-matrix-zeroes/", difficulty: "medium", tags: ["Array", "Matrix"] },
            // Bit Manipulation
            { title: "Number of 1 Bits", url: "https://leetcode.com/problems/number-of-1-bits/", difficulty: "easy", tags: ["Bit Manipulation"] },
            { title: "Counting Bits", url: "https://leetcode.com/problems/counting-bits/", difficulty: "easy", tags: ["Bit Manipulation", "DP"] },
            { title: "Reverse Bits", url: "https://leetcode.com/problems/reverse-bits/", difficulty: "easy", tags: ["Bit Manipulation"] },
            { title: "Missing Number", url: "https://leetcode.com/problems/missing-number/", difficulty: "easy", tags: ["Bit Manipulation", "Math"] },
            { title: "Sum of Two Integers", url: "https://leetcode.com/problems/sum-of-two-integers/", difficulty: "medium", tags: ["Bit Manipulation"] },
            // Extras
            { title: "Word Search", url: "https://leetcode.com/problems/word-search/", difficulty: "medium", tags: ["Backtracking", "Matrix"] },
            { title: "Alien Dictionary", url: "https://leetcode.com/problems/alien-dictionary/", difficulty: "hard", tags: ["Graph", "Topological Sort"] },
        ],
    },
    {
        id: "grind-75",
        name: "Grind 75",
        description: "An updated version of Blind 75 by Yangshun with better problem ordering and coverage.",
        count: 75,
        problems: [
            { title: "Two Sum", url: "https://leetcode.com/problems/two-sum/", difficulty: "easy", tags: ["Array", "Hash Table"] },
            { title: "Valid Parentheses", url: "https://leetcode.com/problems/valid-parentheses/", difficulty: "easy", tags: ["String", "Stack"] },
            { title: "Merge Two Sorted Lists", url: "https://leetcode.com/problems/merge-two-sorted-lists/", difficulty: "easy", tags: ["Linked List"] },
            { title: "Best Time to Buy and Sell Stock", url: "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/", difficulty: "easy", tags: ["Array", "Sliding Window"] },
            { title: "Valid Palindrome", url: "https://leetcode.com/problems/valid-palindrome/", difficulty: "easy", tags: ["Two Pointers", "String"] },
            { title: "Invert Binary Tree", url: "https://leetcode.com/problems/invert-binary-tree/", difficulty: "easy", tags: ["Tree", "BFS", "DFS"] },
            { title: "Valid Anagram", url: "https://leetcode.com/problems/valid-anagram/", difficulty: "easy", tags: ["Hash Table", "String"] },
            { title: "Binary Search", url: "https://leetcode.com/problems/binary-search/", difficulty: "easy", tags: ["Array", "Binary Search"] },
            { title: "Flood Fill", url: "https://leetcode.com/problems/flood-fill/", difficulty: "easy", tags: ["Array", "DFS", "BFS"] },
            { title: "Lowest Common Ancestor of a BST", url: "https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/", difficulty: "medium", tags: ["Tree", "BST"] },
            { title: "Balanced Binary Tree", url: "https://leetcode.com/problems/balanced-binary-tree/", difficulty: "easy", tags: ["Tree", "DFS"] },
            { title: "Linked List Cycle", url: "https://leetcode.com/problems/linked-list-cycle/", difficulty: "easy", tags: ["Linked List", "Two Pointers"] },
            { title: "Implement Queue using Stacks", url: "https://leetcode.com/problems/implement-queue-using-stacks/", difficulty: "easy", tags: ["Stack", "Queue", "Design"] },
            { title: "First Bad Version", url: "https://leetcode.com/problems/first-bad-version/", difficulty: "easy", tags: ["Binary Search"] },
            { title: "Ransom Note", url: "https://leetcode.com/problems/ransom-note/", difficulty: "easy", tags: ["Hash Table", "String"] },
            { title: "Climbing Stairs", url: "https://leetcode.com/problems/climbing-stairs/", difficulty: "easy", tags: ["DP"] },
            { title: "Longest Palindrome", url: "https://leetcode.com/problems/longest-palindrome/", difficulty: "easy", tags: ["Hash Table", "String"] },
            { title: "Reverse Linked List", url: "https://leetcode.com/problems/reverse-linked-list/", difficulty: "easy", tags: ["Linked List"] },
            { title: "Majority Element", url: "https://leetcode.com/problems/majority-element/", difficulty: "easy", tags: ["Array", "Hash Table"] },
            { title: "Add Binary", url: "https://leetcode.com/problems/add-binary/", difficulty: "easy", tags: ["String", "Math"] },
            { title: "Diameter of Binary Tree", url: "https://leetcode.com/problems/diameter-of-binary-tree/", difficulty: "easy", tags: ["Tree", "DFS"] },
            { title: "Middle of the Linked List", url: "https://leetcode.com/problems/middle-of-the-linked-list/", difficulty: "easy", tags: ["Linked List", "Two Pointers"] },
            { title: "Maximum Depth of Binary Tree", url: "https://leetcode.com/problems/maximum-depth-of-binary-tree/", difficulty: "easy", tags: ["Tree", "DFS"] },
            { title: "Contains Duplicate", url: "https://leetcode.com/problems/contains-duplicate/", difficulty: "easy", tags: ["Array", "Hash Table"] },
            { title: "Maximum Subarray", url: "https://leetcode.com/problems/maximum-subarray/", difficulty: "medium", tags: ["Array", "DP"] },
            { title: "Insert Interval", url: "https://leetcode.com/problems/insert-interval/", difficulty: "medium", tags: ["Array", "Intervals"] },
            { title: "01 Matrix", url: "https://leetcode.com/problems/01-matrix/", difficulty: "medium", tags: ["BFS", "Matrix"] },
            { title: "K Closest Points to Origin", url: "https://leetcode.com/problems/k-closest-points-to-origin/", difficulty: "medium", tags: ["Array", "Heap"] },
            { title: "Longest Substring Without Repeating Characters", url: "https://leetcode.com/problems/longest-substring-without-repeating-characters/", difficulty: "medium", tags: ["String", "Sliding Window"] },
            { title: "3Sum", url: "https://leetcode.com/problems/3sum/", difficulty: "medium", tags: ["Array", "Two Pointers"] },
            { title: "Binary Tree Level Order Traversal", url: "https://leetcode.com/problems/binary-tree-level-order-traversal/", difficulty: "medium", tags: ["Tree", "BFS"] },
            { title: "Clone Graph", url: "https://leetcode.com/problems/clone-graph/", difficulty: "medium", tags: ["Graph", "BFS", "DFS"] },
            { title: "Evaluate Reverse Polish Notation", url: "https://leetcode.com/problems/evaluate-reverse-polish-notation/", difficulty: "medium", tags: ["Stack", "Math"] },
            { title: "Course Schedule", url: "https://leetcode.com/problems/course-schedule/", difficulty: "medium", tags: ["Graph", "Topological Sort"] },
            { title: "Implement Trie (Prefix Tree)", url: "https://leetcode.com/problems/implement-trie-prefix-tree/", difficulty: "medium", tags: ["Trie", "Design"] },
            { title: "Coin Change", url: "https://leetcode.com/problems/coin-change/", difficulty: "medium", tags: ["DP"] },
            { title: "Product of Array Except Self", url: "https://leetcode.com/problems/product-of-array-except-self/", difficulty: "medium", tags: ["Array", "Prefix Sum"] },
            { title: "Min Stack", url: "https://leetcode.com/problems/min-stack/", difficulty: "medium", tags: ["Stack", "Design"] },
            { title: "Validate Binary Search Tree", url: "https://leetcode.com/problems/validate-binary-search-tree/", difficulty: "medium", tags: ["Tree", "BST", "DFS"] },
            { title: "Number of Islands", url: "https://leetcode.com/problems/number-of-islands/", difficulty: "medium", tags: ["Graph", "BFS", "DFS"] },
            { title: "Rotting Oranges", url: "https://leetcode.com/problems/rotting-oranges/", difficulty: "medium", tags: ["BFS", "Matrix"] },
            { title: "Search in Rotated Sorted Array", url: "https://leetcode.com/problems/search-in-rotated-sorted-array/", difficulty: "medium", tags: ["Array", "Binary Search"] },
            { title: "Combination Sum", url: "https://leetcode.com/problems/combination-sum/", difficulty: "medium", tags: ["Array", "Backtracking"] },
            { title: "Permutations", url: "https://leetcode.com/problems/permutations/", difficulty: "medium", tags: ["Array", "Backtracking"] },
            { title: "Merge Intervals", url: "https://leetcode.com/problems/merge-intervals/", difficulty: "medium", tags: ["Array", "Intervals"] },
            { title: "Lowest Common Ancestor of a Binary Tree", url: "https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/", difficulty: "medium", tags: ["Tree", "DFS"] },
            { title: "Time Based Key-Value Store", url: "https://leetcode.com/problems/time-based-key-value-store/", difficulty: "medium", tags: ["Binary Search", "Design"] },
            { title: "Accounts Merge", url: "https://leetcode.com/problems/accounts-merge/", difficulty: "medium", tags: ["Graph", "Union Find"] },
            { title: "Sort Colors", url: "https://leetcode.com/problems/sort-colors/", difficulty: "medium", tags: ["Array", "Two Pointers"] },
            { title: "Word Break", url: "https://leetcode.com/problems/word-break/", difficulty: "medium", tags: ["DP", "String"] },
            { title: "Partition Equal Subset Sum", url: "https://leetcode.com/problems/partition-equal-subset-sum/", difficulty: "medium", tags: ["DP", "Array"] },
            { title: "String to Integer (atoi)", url: "https://leetcode.com/problems/string-to-integer-atoi/", difficulty: "medium", tags: ["String"] },
            { title: "Spiral Matrix", url: "https://leetcode.com/problems/spiral-matrix/", difficulty: "medium", tags: ["Array", "Matrix"] },
            { title: "Subsets", url: "https://leetcode.com/problems/subsets/", difficulty: "medium", tags: ["Array", "Backtracking"] },
            { title: "Binary Tree Right Side View", url: "https://leetcode.com/problems/binary-tree-right-side-view/", difficulty: "medium", tags: ["Tree", "BFS"] },
            { title: "Longest Palindromic Substring", url: "https://leetcode.com/problems/longest-palindromic-substring/", difficulty: "medium", tags: ["DP", "String"] },
            { title: "Unique Paths", url: "https://leetcode.com/problems/unique-paths/", difficulty: "medium", tags: ["DP", "Math"] },
            { title: "Construct Binary Tree from Preorder and Inorder Traversal", url: "https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/", difficulty: "medium", tags: ["Tree", "DFS"] },
            { title: "Container With Most Water", url: "https://leetcode.com/problems/container-with-most-water/", difficulty: "medium", tags: ["Array", "Two Pointers"] },
            { title: "Letter Combinations of a Phone Number", url: "https://leetcode.com/problems/letter-combinations-of-a-phone-number/", difficulty: "medium", tags: ["String", "Backtracking"] },
            { title: "Word Search", url: "https://leetcode.com/problems/word-search/", difficulty: "medium", tags: ["Backtracking", "Matrix"] },
            { title: "Find All Anagrams in a String", url: "https://leetcode.com/problems/find-all-anagrams-in-a-string/", difficulty: "medium", tags: ["String", "Sliding Window"] },
            { title: "Minimum Height Trees", url: "https://leetcode.com/problems/minimum-height-trees/", difficulty: "medium", tags: ["Graph", "BFS"] },
            { title: "Task Scheduler", url: "https://leetcode.com/problems/task-scheduler/", difficulty: "medium", tags: ["Array", "Greedy", "Heap"] },
            { title: "LRU Cache", url: "https://leetcode.com/problems/lru-cache/", difficulty: "medium", tags: ["Hash Table", "Linked List", "Design"] },
            // Hard
            { title: "Minimum Window Substring", url: "https://leetcode.com/problems/minimum-window-substring/", difficulty: "hard", tags: ["String", "Sliding Window"] },
            { title: "Serialize and Deserialize Binary Tree", url: "https://leetcode.com/problems/serialize-and-deserialize-binary-tree/", difficulty: "hard", tags: ["Tree", "BFS", "DFS"] },
            { title: "Trapping Rain Water", url: "https://leetcode.com/problems/trapping-rain-water/", difficulty: "hard", tags: ["Array", "Two Pointers", "Stack"] },
            { title: "Find Median from Data Stream", url: "https://leetcode.com/problems/find-median-from-data-stream/", difficulty: "hard", tags: ["Heap", "Design"] },
            { title: "Word Ladder", url: "https://leetcode.com/problems/word-ladder/", difficulty: "hard", tags: ["String", "BFS"] },
            { title: "Basic Calculator", url: "https://leetcode.com/problems/basic-calculator/", difficulty: "hard", tags: ["Stack", "Math"] },
            { title: "Maximum Profit in Job Scheduling", url: "https://leetcode.com/problems/maximum-profit-in-job-scheduling/", difficulty: "hard", tags: ["DP", "Binary Search"] },
            { title: "Merge K Sorted Lists", url: "https://leetcode.com/problems/merge-k-sorted-lists/", difficulty: "hard", tags: ["Linked List", "Heap"] },
            { title: "Largest Rectangle in Histogram", url: "https://leetcode.com/problems/largest-rectangle-in-histogram/", difficulty: "hard", tags: ["Array", "Stack"] },
            { title: "Binary Tree Maximum Path Sum", url: "https://leetcode.com/problems/binary-tree-maximum-path-sum/", difficulty: "hard", tags: ["Tree", "DFS"] },
        ],
    },
    {
        id: "neetcode-150",
        name: "NeetCode 150",
        description: "The expanded NeetCode roadmap with 150 problems organized by pattern. Includes everything from Blind 75 plus additional key problems.",
        count: 150,
        problems: [
            // Arrays & Hashing (additional to Blind 75)
            { title: "Valid Sudoku", url: "https://leetcode.com/problems/valid-sudoku/", difficulty: "medium", tags: ["Array", "Hash Table", "Matrix"] },
            // Two Pointers
            { title: "Two Sum II - Input Array Is Sorted", url: "https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/", difficulty: "medium", tags: ["Array", "Two Pointers"] },
            { title: "Trapping Rain Water", url: "https://leetcode.com/problems/trapping-rain-water/", difficulty: "hard", tags: ["Array", "Two Pointers", "Stack"] },
            // Stack
            { title: "Min Stack", url: "https://leetcode.com/problems/min-stack/", difficulty: "medium", tags: ["Stack", "Design"] },
            { title: "Evaluate Reverse Polish Notation", url: "https://leetcode.com/problems/evaluate-reverse-polish-notation/", difficulty: "medium", tags: ["Stack", "Math"] },
            { title: "Generate Parentheses", url: "https://leetcode.com/problems/generate-parentheses/", difficulty: "medium", tags: ["String", "Stack", "Backtracking"] },
            { title: "Daily Temperatures", url: "https://leetcode.com/problems/daily-temperatures/", difficulty: "medium", tags: ["Array", "Stack"] },
            { title: "Car Fleet", url: "https://leetcode.com/problems/car-fleet/", difficulty: "medium", tags: ["Array", "Stack"] },
            { title: "Largest Rectangle in Histogram", url: "https://leetcode.com/problems/largest-rectangle-in-histogram/", difficulty: "hard", tags: ["Array", "Stack"] },
            // Binary Search
            { title: "Binary Search", url: "https://leetcode.com/problems/binary-search/", difficulty: "easy", tags: ["Array", "Binary Search"] },
            { title: "Search a 2D Matrix", url: "https://leetcode.com/problems/search-a-2d-matrix/", difficulty: "medium", tags: ["Array", "Binary Search", "Matrix"] },
            { title: "Koko Eating Bananas", url: "https://leetcode.com/problems/koko-eating-bananas/", difficulty: "medium", tags: ["Array", "Binary Search"] },
            { title: "Time Based Key-Value Store", url: "https://leetcode.com/problems/time-based-key-value-store/", difficulty: "medium", tags: ["Binary Search", "Design"] },
            { title: "Median of Two Sorted Arrays", url: "https://leetcode.com/problems/median-of-two-sorted-arrays/", difficulty: "hard", tags: ["Array", "Binary Search"] },
            // Linked List
            { title: "Copy List with Random Pointer", url: "https://leetcode.com/problems/copy-list-with-random-pointer/", difficulty: "medium", tags: ["Linked List", "Hash Table"] },
            { title: "Add Two Numbers", url: "https://leetcode.com/problems/add-two-numbers/", difficulty: "medium", tags: ["Linked List", "Math"] },
            { title: "LRU Cache", url: "https://leetcode.com/problems/lru-cache/", difficulty: "medium", tags: ["Hash Table", "Linked List", "Design"] },
            { title: "Reverse Nodes in k-Group", url: "https://leetcode.com/problems/reverse-nodes-in-k-group/", difficulty: "hard", tags: ["Linked List"] },
            // Trees
            { title: "Count Good Nodes in Binary Tree", url: "https://leetcode.com/problems/count-good-nodes-in-binary-tree/", difficulty: "medium", tags: ["Tree", "DFS"] },
            { title: "Binary Tree Right Side View", url: "https://leetcode.com/problems/binary-tree-right-side-view/", difficulty: "medium", tags: ["Tree", "BFS"] },
            // Graphs
            { title: "Walls and Gates", url: "https://leetcode.com/problems/walls-and-gates/", difficulty: "medium", tags: ["BFS", "Matrix"] },
            { title: "Rotting Oranges", url: "https://leetcode.com/problems/rotting-oranges/", difficulty: "medium", tags: ["BFS", "Matrix"] },
            { title: "Surrounded Regions", url: "https://leetcode.com/problems/surrounded-regions/", difficulty: "medium", tags: ["Graph", "DFS"] },
            { title: "Course Schedule II", url: "https://leetcode.com/problems/course-schedule-ii/", difficulty: "medium", tags: ["Graph", "Topological Sort"] },
            { title: "Redundant Connection", url: "https://leetcode.com/problems/redundant-connection/", difficulty: "medium", tags: ["Graph", "Union Find"] },
            // 1-D DP
            { title: "Min Cost Climbing Stairs", url: "https://leetcode.com/problems/min-cost-climbing-stairs/", difficulty: "easy", tags: ["DP"] },
            { title: "Partition Equal Subset Sum", url: "https://leetcode.com/problems/partition-equal-subset-sum/", difficulty: "medium", tags: ["DP", "Array"] },
            // 2-D DP
            { title: "Longest Common Subsequence", url: "https://leetcode.com/problems/longest-common-subsequence/", difficulty: "medium", tags: ["DP", "String"] },
            { title: "Target Sum", url: "https://leetcode.com/problems/target-sum/", difficulty: "medium", tags: ["DP", "Backtracking"] },
            { title: "Interleaving String", url: "https://leetcode.com/problems/interleaving-string/", difficulty: "medium", tags: ["DP", "String"] },
            { title: "Edit Distance", url: "https://leetcode.com/problems/edit-distance/", difficulty: "medium", tags: ["DP", "String"] },
            { title: "Distinct Subsequences", url: "https://leetcode.com/problems/distinct-subsequences/", difficulty: "hard", tags: ["DP", "String"] },
            { title: "Burst Balloons", url: "https://leetcode.com/problems/burst-balloons/", difficulty: "hard", tags: ["DP"] },
            { title: "Regular Expression Matching", url: "https://leetcode.com/problems/regular-expression-matching/", difficulty: "hard", tags: ["DP", "String"] },
            // Greedy
            { title: "Jump Game II", url: "https://leetcode.com/problems/jump-game-ii/", difficulty: "medium", tags: ["Array", "Greedy"] },
            { title: "Gas Station", url: "https://leetcode.com/problems/gas-station/", difficulty: "medium", tags: ["Array", "Greedy"] },
            { title: "Hand of Straights", url: "https://leetcode.com/problems/hand-of-straights/", difficulty: "medium", tags: ["Array", "Greedy"] },
            // Intervals
            { title: "Minimum Interval to Include Each Query", url: "https://leetcode.com/problems/minimum-interval-to-include-each-query/", difficulty: "hard", tags: ["Array", "Intervals", "Heap"] },
            // Backtracking
            { title: "Subsets", url: "https://leetcode.com/problems/subsets/", difficulty: "medium", tags: ["Array", "Backtracking"] },
            { title: "Combination Sum", url: "https://leetcode.com/problems/combination-sum/", difficulty: "medium", tags: ["Array", "Backtracking"] },
            { title: "Permutations", url: "https://leetcode.com/problems/permutations/", difficulty: "medium", tags: ["Array", "Backtracking"] },
            { title: "Combination Sum II", url: "https://leetcode.com/problems/combination-sum-ii/", difficulty: "medium", tags: ["Array", "Backtracking"] },
            { title: "Subsets II", url: "https://leetcode.com/problems/subsets-ii/", difficulty: "medium", tags: ["Array", "Backtracking"] },
            { title: "Palindrome Partitioning", url: "https://leetcode.com/problems/palindrome-partitioning/", difficulty: "medium", tags: ["String", "Backtracking", "DP"] },
            { title: "Letter Combinations of a Phone Number", url: "https://leetcode.com/problems/letter-combinations-of-a-phone-number/", difficulty: "medium", tags: ["String", "Backtracking"] },
            { title: "N-Queens", url: "https://leetcode.com/problems/n-queens/", difficulty: "hard", tags: ["Backtracking", "Matrix"] },
            // Math & Geometry
            { title: "Happy Number", url: "https://leetcode.com/problems/happy-number/", difficulty: "easy", tags: ["Math", "Hash Table"] },
            { title: "Plus One", url: "https://leetcode.com/problems/plus-one/", difficulty: "easy", tags: ["Array", "Math"] },
            { title: "Pow(x, n)", url: "https://leetcode.com/problems/powx-n/", difficulty: "medium", tags: ["Math"] },
            { title: "Multiply Strings", url: "https://leetcode.com/problems/multiply-strings/", difficulty: "medium", tags: ["String", "Math"] },
            { title: "Detect Squares", url: "https://leetcode.com/problems/detect-squares/", difficulty: "medium", tags: ["Array", "Math", "Design"] },
        ],
    },
];
