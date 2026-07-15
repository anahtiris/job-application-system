// ─── LeetCode reference problems ────────────────────────────────────────────────
// Static, curated reference for technical-interview prep. Read-only.

export type Difficulty = "Easy" | "Medium" | "Hard";

export const CATEGORIES = [
  "Arrays & Hashing",
  "Two Pointers",
  "Sliding Window",
  "Stack",
  "Binary Search",
  "Linked List",
  "Trees",
  "Graphs",
  "Dynamic Programming",
  "Intervals",
  "Greedy",
  "Bit Manipulation",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface LeetCodeProblem {
  id: string;
  number: number;
  title: string;
  difficulty: Difficulty;
  category: Category;
  pattern: string;
  url: string;
  prompt: string;
  approach: string;
  complexity: string;
  solutions: {
    java: string;
    python: string;
    typescript: string;
  };
}

export const PROBLEMS: LeetCodeProblem[] = [
  // ─── Arrays & Hashing ──────────────────────────────────────────────────────
  {
    id: "two-sum",
    number: 1,
    title: "Two Sum",
    difficulty: "Easy",
    category: "Arrays & Hashing",
    pattern: "Hash Map",
    url: "https://leetcode.com/problems/two-sum/",
    prompt:
      "Given an array of integers nums and an integer target, return the indices of the two numbers that add up to target. Exactly one valid answer exists.",
    approach:
      "Store each value's index in a hash map as you scan. For every number, check whether its complement (target - num) was already seen. One pass, no sorting needed.",
    complexity: "Time O(n), Space O(n)",
    solutions: {
      java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int need = target - nums[i];
            if (seen.containsKey(need)) {
                return new int[]{seen.get(need), i};
            }
            seen.put(nums[i], i);
        }
        return new int[]{};
    }
}`,
      python: `def two_sum(nums: list[int], target: int) -> list[int]:
    seen: dict[int, int] = {}
    for i, n in enumerate(nums):
        need = target - n
        if need in seen:
            return [seen[need], i]
        seen[n] = i
    return []`,
      typescript: `function twoSum(nums: number[], target: number): number[] {
    const seen = new Map<number, number>();
    for (let i = 0; i < nums.length; i++) {
        const need = target - nums[i];
        if (seen.has(need)) {
            return [seen.get(need)!, i];
        }
        seen.set(nums[i], i);
    }
    return [];
}`,
    },
  },
  {
    id: "contains-duplicate",
    number: 217,
    title: "Contains Duplicate",
    difficulty: "Easy",
    category: "Arrays & Hashing",
    pattern: "Hash Set",
    url: "https://leetcode.com/problems/contains-duplicate/",
    prompt: "Given an integer array nums, return true if any value appears at least twice.",
    approach:
      "Insert each value into a hash set while scanning. If an insert finds the value already present, a duplicate exists.",
    complexity: "Time O(n), Space O(n)",
    solutions: {
      java: `class Solution {
    public boolean containsDuplicate(int[] nums) {
        Set<Integer> seen = new HashSet<>();
        for (int n : nums) {
            if (!seen.add(n)) return true;
        }
        return false;
    }
}`,
      python: `def contains_duplicate(nums: list[int]) -> bool:
    seen: set[int] = set()
    for n in nums:
        if n in seen:
            return True
        seen.add(n)
    return False`,
      typescript: `function containsDuplicate(nums: number[]): boolean {
    const seen = new Set<number>();
    for (const n of nums) {
        if (seen.has(n)) return true;
        seen.add(n);
    }
    return false;
}`,
    },
  },
  {
    id: "valid-anagram",
    number: 242,
    title: "Valid Anagram",
    difficulty: "Easy",
    category: "Arrays & Hashing",
    pattern: "Hash Map / Counting",
    url: "https://leetcode.com/problems/valid-anagram/",
    prompt:
      "Given two strings s and t, return true if t is an anagram of s (same characters, same counts).",
    approach:
      "Count each character in s, then decrement while scanning t. If any count goes negative or lengths differ, they are not anagrams. All counts return to zero on a match.",
    complexity: "Time O(n), Space O(1) for a fixed alphabet",
    solutions: {
      java: `class Solution {
    public boolean isAnagram(String s, String t) {
        if (s.length() != t.length()) return false;
        int[] counts = new int[26];
        for (int i = 0; i < s.length(); i++) {
            counts[s.charAt(i) - 'a']++;
            counts[t.charAt(i) - 'a']--;
        }
        for (int c : counts) if (c != 0) return false;
        return true;
    }
}`,
      python: `from collections import Counter

def is_anagram(s: str, t: str) -> bool:
    return len(s) == len(t) and Counter(s) == Counter(t)`,
      typescript: `function isAnagram(s: string, t: string): boolean {
    if (s.length !== t.length) return false;
    const counts = new Map<string, number>();
    for (const c of s) counts.set(c, (counts.get(c) ?? 0) + 1);
    for (const c of t) {
        const n = counts.get(c) ?? 0;
        if (n === 0) return false;
        counts.set(c, n - 1);
    }
    return true;
}`,
    },
  },
  {
    id: "group-anagrams",
    number: 49,
    title: "Group Anagrams",
    difficulty: "Medium",
    category: "Arrays & Hashing",
    pattern: "Hash Map",
    url: "https://leetcode.com/problems/group-anagrams/",
    prompt: "Given an array of strings, group the anagrams together (any order).",
    approach:
      "Use each string's sorted characters as a hash map key, since anagrams share the same sorted form. Append every string to its key's bucket.",
    complexity: "Time O(n * k log k), Space O(n * k) — k = average string length",
    solutions: {
      java: `class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
        Map<String, List<String>> groups = new HashMap<>();
        for (String s : strs) {
            char[] chars = s.toCharArray();
            Arrays.sort(chars);
            String key = new String(chars);
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }
        return new ArrayList<>(groups.values());
    }
}`,
      python: `def group_anagrams(strs: list[str]) -> list[list[str]]:
    groups: dict[str, list[str]] = {}
    for s in strs:
        key = "".join(sorted(s))
        groups.setdefault(key, []).append(s)
    return list(groups.values())`,
      typescript: `function groupAnagrams(strs: string[]): string[][] {
    const groups = new Map<string, string[]>();
    for (const s of strs) {
        const key = s.split("").sort().join("");
        const bucket = groups.get(key);
        if (bucket) bucket.push(s);
        else groups.set(key, [s]);
    }
    return Array.from(groups.values());
}`,
    },
  },
  {
    id: "top-k-frequent-elements",
    number: 347,
    title: "Top K Frequent Elements",
    difficulty: "Medium",
    category: "Arrays & Hashing",
    pattern: "Bucket Sort",
    url: "https://leetcode.com/problems/top-k-frequent-elements/",
    prompt: "Return the k most frequent elements in nums, in any order.",
    approach:
      "Count frequencies, then bucket sort by frequency (bucket index = count, capped at n). Read buckets from the highest frequency down until k elements are collected — avoids an O(n log n) sort.",
    complexity: "Time O(n), Space O(n)",
    solutions: {
      java: `class Solution {
    public int[] topKFrequent(int[] nums, int k) {
        Map<Integer, Integer> counts = new HashMap<>();
        for (int n : nums) counts.merge(n, 1, Integer::sum);

        List<Integer>[] buckets = new List[nums.length + 1];
        for (Map.Entry<Integer, Integer> e : counts.entrySet()) {
            int freq = e.getValue();
            if (buckets[freq] == null) buckets[freq] = new ArrayList<>();
            buckets[freq].add(e.getKey());
        }

        int[] result = new int[k];
        int idx = 0;
        for (int freq = buckets.length - 1; freq >= 0 && idx < k; freq--) {
            if (buckets[freq] == null) continue;
            for (int n : buckets[freq]) {
                if (idx == k) break;
                result[idx++] = n;
            }
        }
        return result;
    }
}`,
      python: `from collections import Counter

def top_k_frequent(nums: list[int], k: int) -> list[int]:
    counts = Counter(nums)
    buckets: list[list[int]] = [[] for _ in range(len(nums) + 1)]
    for n, freq in counts.items():
        buckets[freq].append(n)

    result: list[int] = []
    for freq in range(len(buckets) - 1, 0, -1):
        for n in buckets[freq]:
            result.append(n)
            if len(result) == k:
                return result
    return result`,
      typescript: `function topKFrequent(nums: number[], k: number): number[] {
    const counts = new Map<number, number>();
    for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1);

    const buckets: number[][] = Array.from({ length: nums.length + 1 }, () => []);
    for (const [n, freq] of counts) buckets[freq].push(n);

    const result: number[] = [];
    for (let freq = buckets.length - 1; freq >= 0 && result.length < k; freq--) {
        for (const n of buckets[freq]) {
            if (result.length === k) break;
            result.push(n);
        }
    }
    return result;
}`,
    },
  },
  {
    id: "product-of-array-except-self",
    number: 238,
    title: "Product of Array Except Self",
    difficulty: "Medium",
    category: "Arrays & Hashing",
    pattern: "Prefix / Suffix Products",
    url: "https://leetcode.com/problems/product-of-array-except-self/",
    prompt:
      "Return an array where each element is the product of all other elements in nums, without using division, in O(n).",
    approach:
      "Two passes over the output array: first fill it with prefix products from the left, then multiply in suffix products while walking from the right.",
    complexity: "Time O(n), Space O(1) extra (output array excluded)",
    solutions: {
      java: `class Solution {
    public int[] productExceptSelf(int[] nums) {
        int n = nums.length;
        int[] result = new int[n];
        result[0] = 1;
        for (int i = 1; i < n; i++) result[i] = result[i - 1] * nums[i - 1];

        int suffix = 1;
        for (int i = n - 1; i >= 0; i--) {
            result[i] *= suffix;
            suffix *= nums[i];
        }
        return result;
    }
}`,
      python: `def product_except_self(nums: list[int]) -> list[int]:
    n = len(nums)
    result = [1] * n
    for i in range(1, n):
        result[i] = result[i - 1] * nums[i - 1]

    suffix = 1
    for i in range(n - 1, -1, -1):
        result[i] *= suffix
        suffix *= nums[i]
    return result`,
      typescript: `function productExceptSelf(nums: number[]): number[] {
    const n = nums.length;
    const result = new Array<number>(n).fill(1);
    for (let i = 1; i < n; i++) result[i] = result[i - 1] * nums[i - 1];

    let suffix = 1;
    for (let i = n - 1; i >= 0; i--) {
        result[i] *= suffix;
        suffix *= nums[i];
    }
    return result;
}`,
    },
  },
  {
    id: "longest-consecutive-sequence",
    number: 128,
    title: "Longest Consecutive Sequence",
    difficulty: "Medium",
    category: "Arrays & Hashing",
    pattern: "Hash Set",
    url: "https://leetcode.com/problems/longest-consecutive-sequence/",
    prompt:
      "Given an unsorted array of integers, return the length of the longest run of consecutive integers, in O(n).",
    approach:
      "Put every number in a set. Only start counting a run from numbers whose predecessor (n-1) is absent — that guarantees each run is walked exactly once, from its true start.",
    complexity: "Time O(n), Space O(n)",
    solutions: {
      java: `class Solution {
    public int longestConsecutive(int[] nums) {
        Set<Integer> set = new HashSet<>();
        for (int n : nums) set.add(n);

        int best = 0;
        for (int n : set) {
            if (set.contains(n - 1)) continue;
            int length = 1;
            while (set.contains(n + length)) length++;
            best = Math.max(best, length);
        }
        return best;
    }
}`,
      python: `def longest_consecutive(nums: list[int]) -> int:
    num_set = set(nums)
    best = 0
    for n in num_set:
        if n - 1 in num_set:
            continue
        length = 1
        while n + length in num_set:
            length += 1
        best = max(best, length)
    return best`,
      typescript: `function longestConsecutive(nums: number[]): number {
    const set = new Set(nums);
    let best = 0;
    for (const n of set) {
        if (set.has(n - 1)) continue;
        let length = 1;
        while (set.has(n + length)) length++;
        best = Math.max(best, length);
    }
    return best;
}`,
    },
  },

  // ─── Two Pointers ────────────────────────────────────────────────────────────
  {
    id: "3sum",
    number: 15,
    title: "3Sum",
    difficulty: "Medium",
    category: "Two Pointers",
    pattern: "Sort + Two Pointers",
    url: "https://leetcode.com/problems/3sum/",
    prompt: "Return all unique triplets [a, b, c] in nums such that a + b + c = 0.",
    approach:
      "Sort the array. Fix each number in turn, then use two pointers on the remainder to find pairs summing to its negation, skipping duplicate values at both the outer and inner level.",
    complexity: "Time O(n^2), Space O(1) extra excluding sort/output",
    solutions: {
      java: `class Solution {
    public List<List<Integer>> threeSum(int[] nums) {
        Arrays.sort(nums);
        List<List<Integer>> result = new ArrayList<>();
        for (int i = 0; i < nums.length - 2; i++) {
            if (i > 0 && nums[i] == nums[i - 1]) continue;
            int lo = i + 1, hi = nums.length - 1;
            while (lo < hi) {
                int sum = nums[i] + nums[lo] + nums[hi];
                if (sum < 0) lo++;
                else if (sum > 0) hi--;
                else {
                    result.add(Arrays.asList(nums[i], nums[lo], nums[hi]));
                    lo++; hi--;
                    while (lo < hi && nums[lo] == nums[lo - 1]) lo++;
                }
            }
        }
        return result;
    }
}`,
      python: `def three_sum(nums: list[int]) -> list[list[int]]:
    nums.sort()
    result: list[list[int]] = []
    for i in range(len(nums) - 2):
        if i > 0 and nums[i] == nums[i - 1]:
            continue
        lo, hi = i + 1, len(nums) - 1
        while lo < hi:
            total = nums[i] + nums[lo] + nums[hi]
            if total < 0:
                lo += 1
            elif total > 0:
                hi -= 1
            else:
                result.append([nums[i], nums[lo], nums[hi]])
                lo += 1
                hi -= 1
                while lo < hi and nums[lo] == nums[lo - 1]:
                    lo += 1
    return result`,
      typescript: `function threeSum(nums: number[]): number[][] {
    nums.sort((a, b) => a - b);
    const result: number[][] = [];
    for (let i = 0; i < nums.length - 2; i++) {
        if (i > 0 && nums[i] === nums[i - 1]) continue;
        let lo = i + 1;
        let hi = nums.length - 1;
        while (lo < hi) {
            const sum = nums[i] + nums[lo] + nums[hi];
            if (sum < 0) lo++;
            else if (sum > 0) hi--;
            else {
                result.push([nums[i], nums[lo], nums[hi]]);
                lo++; hi--;
                while (lo < hi && nums[lo] === nums[lo - 1]) lo++;
            }
        }
    }
    return result;
}`,
    },
  },
  {
    id: "container-with-most-water",
    number: 11,
    title: "Container With Most Water",
    difficulty: "Medium",
    category: "Two Pointers",
    pattern: "Two Pointers",
    url: "https://leetcode.com/problems/container-with-most-water/",
    prompt:
      "Given heights of vertical lines, choose two that, together with the x-axis, form a container holding the most water.",
    approach:
      "Start pointers at both ends. The shorter of the two lines always bounds the area, so moving the taller pointer inward can never help — move the shorter one instead, tracking the best area seen.",
    complexity: "Time O(n), Space O(1)",
    solutions: {
      java: `class Solution {
    public int maxArea(int[] height) {
        int lo = 0, hi = height.length - 1, best = 0;
        while (lo < hi) {
            int area = Math.min(height[lo], height[hi]) * (hi - lo);
            best = Math.max(best, area);
            if (height[lo] < height[hi]) lo++;
            else hi--;
        }
        return best;
    }
}`,
      python: `def max_area(height: list[int]) -> int:
    lo, hi = 0, len(height) - 1
    best = 0
    while lo < hi:
        best = max(best, min(height[lo], height[hi]) * (hi - lo))
        if height[lo] < height[hi]:
            lo += 1
        else:
            hi -= 1
    return best`,
      typescript: `function maxArea(height: number[]): number {
    let lo = 0;
    let hi = height.length - 1;
    let best = 0;
    while (lo < hi) {
        best = Math.max(best, Math.min(height[lo], height[hi]) * (hi - lo));
        if (height[lo] < height[hi]) lo++;
        else hi--;
    }
    return best;
}`,
    },
  },
  {
    id: "merge-two-sorted-lists",
    number: 21,
    title: "Merge Two Sorted Lists",
    difficulty: "Easy",
    category: "Two Pointers",
    pattern: "Linked List / Two Pointers",
    url: "https://leetcode.com/problems/merge-two-sorted-lists/",
    prompt:
      "Merge two sorted linked lists into one sorted list by splicing their nodes together. Return the head of the merged list.",
    approach:
      "Use a dummy head and a tail pointer. Repeatedly attach the smaller of the two current nodes and advance that list. Append whatever remains once one list runs out.",
    complexity: "Time O(n + m), Space O(1)",
    solutions: {
      java: `class Solution {
    public ListNode mergeTwoLists(ListNode a, ListNode b) {
        ListNode dummy = new ListNode(0), tail = dummy;
        while (a != null && b != null) {
            if (a.val <= b.val) { tail.next = a; a = a.next; }
            else { tail.next = b; b = b.next; }
            tail = tail.next;
        }
        tail.next = (a != null) ? a : b;
        return dummy.next;
    }
}`,
      python: `def merge_two_lists(a: ListNode | None, b: ListNode | None) -> ListNode | None:
    dummy = tail = ListNode(0)
    while a and b:
        if a.val <= b.val:
            tail.next, a = a, a.next
        else:
            tail.next, b = b, b.next
        tail = tail.next
    tail.next = a or b
    return dummy.next`,
      typescript: `function mergeTwoLists(a: ListNode | null, b: ListNode | null): ListNode | null {
    const dummy = new ListNode(0);
    let tail = dummy;
    while (a && b) {
        if (a.val <= b.val) { tail.next = a; a = a.next; }
        else { tail.next = b; b = b.next; }
        tail = tail.next;
    }
    tail.next = a ?? b;
    return dummy.next;
}`,
    },
  },

  // ─── Sliding Window ──────────────────────────────────────────────────────────
  {
    id: "best-time-to-buy-sell-stock",
    number: 121,
    title: "Best Time to Buy and Sell Stock",
    difficulty: "Easy",
    category: "Sliding Window",
    pattern: "Greedy / Sliding Window",
    url: "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/",
    prompt:
      "Given daily prices, return the maximum profit from buying on one day and selling on a later day. Return 0 if no profit is possible.",
    approach:
      "Track the lowest price seen so far. At each day, the best sale is today's price minus that minimum; keep the largest such gap. One pass.",
    complexity: "Time O(n), Space O(1)",
    solutions: {
      java: `class Solution {
    public int maxProfit(int[] prices) {
        int minPrice = Integer.MAX_VALUE, best = 0;
        for (int p : prices) {
            minPrice = Math.min(minPrice, p);
            best = Math.max(best, p - minPrice);
        }
        return best;
    }
}`,
      python: `def max_profit(prices: list[int]) -> int:
    min_price = float("inf")
    best = 0
    for p in prices:
        min_price = min(min_price, p)
        best = max(best, p - min_price)
    return best`,
      typescript: `function maxProfit(prices: number[]): number {
    let minPrice = Infinity;
    let best = 0;
    for (const p of prices) {
        minPrice = Math.min(minPrice, p);
        best = Math.max(best, p - minPrice);
    }
    return best;
}`,
    },
  },
  {
    id: "longest-substring-without-repeating-characters",
    number: 3,
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    category: "Sliding Window",
    pattern: "Sliding Window",
    url: "https://leetcode.com/problems/longest-substring-without-repeating-characters/",
    prompt: "Find the length of the longest substring of s without repeating characters.",
    approach:
      "Slide a window with a hash map of each character's last-seen index. When the current character was seen inside the window, jump the left edge past that earlier occurrence.",
    complexity: "Time O(n), Space O(min(n, alphabet size))",
    solutions: {
      java: `class Solution {
    public int lengthOfLongestSubstring(String s) {
        Map<Character, Integer> lastSeen = new HashMap<>();
        int best = 0, left = 0;
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            if (lastSeen.containsKey(c) && lastSeen.get(c) >= left) {
                left = lastSeen.get(c) + 1;
            }
            lastSeen.put(c, right);
            best = Math.max(best, right - left + 1);
        }
        return best;
    }
}`,
      python: `def length_of_longest_substring(s: str) -> int:
    last_seen: dict[str, int] = {}
    best = 0
    left = 0
    for right, c in enumerate(s):
        if c in last_seen and last_seen[c] >= left:
            left = last_seen[c] + 1
        last_seen[c] = right
        best = max(best, right - left + 1)
    return best`,
      typescript: `function lengthOfLongestSubstring(s: string): number {
    const lastSeen = new Map<string, number>();
    let best = 0;
    let left = 0;
    for (let right = 0; right < s.length; right++) {
        const c = s[right];
        const seenAt = lastSeen.get(c);
        if (seenAt !== undefined && seenAt >= left) left = seenAt + 1;
        lastSeen.set(c, right);
        best = Math.max(best, right - left + 1);
    }
    return best;
}`,
    },
  },

  // ─── Stack ───────────────────────────────────────────────────────────────────
  {
    id: "valid-parentheses",
    number: 20,
    title: "Valid Parentheses",
    difficulty: "Easy",
    category: "Stack",
    pattern: "Stack",
    url: "https://leetcode.com/problems/valid-parentheses/",
    prompt:
      "Given a string s of just '()[]{}', decide whether every opening bracket is closed by the matching type in the correct order.",
    approach:
      "Push opening brackets onto a stack. On a closing bracket, the top of the stack must be its matching opener, otherwise the string is invalid. Valid input leaves the stack empty.",
    complexity: "Time O(n), Space O(n)",
    solutions: {
      java: `class Solution {
    public boolean isValid(String s) {
        Deque<Character> stack = new ArrayDeque<>();
        Map<Character, Character> pairs = Map.of(')', '(', ']', '[', '}', '{');
        for (char c : s.toCharArray()) {
            if (pairs.containsKey(c)) {
                if (stack.isEmpty() || stack.pop() != pairs.get(c)) return false;
            } else {
                stack.push(c);
            }
        }
        return stack.isEmpty();
    }
}`,
      python: `def is_valid(s: str) -> bool:
    stack: list[str] = []
    pairs = {")": "(", "]": "[", "}": "{"}
    for c in s:
        if c in pairs:
            if not stack or stack.pop() != pairs[c]:
                return False
        else:
            stack.append(c)
    return not stack`,
      typescript: `function isValid(s: string): boolean {
    const stack: string[] = [];
    const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
    for (const c of s) {
        if (c in pairs) {
            if (stack.pop() !== pairs[c]) return false;
        } else {
            stack.push(c);
        }
    }
    return stack.length === 0;
}`,
    },
  },

  // ─── Binary Search ───────────────────────────────────────────────────────────
  {
    id: "binary-search",
    number: 704,
    title: "Binary Search",
    difficulty: "Easy",
    category: "Binary Search",
    pattern: "Binary Search",
    url: "https://leetcode.com/problems/binary-search/",
    prompt:
      "Given a sorted array of distinct integers and a target, return its index, or -1 if it is absent. Must run in O(log n).",
    approach:
      "Maintain a [low, high] window. Compare the middle element to the target and discard the half that cannot contain it. Use low + (high - low) / 2 to avoid overflow.",
    complexity: "Time O(log n), Space O(1)",
    solutions: {
      java: `class Solution {
    public int search(int[] nums, int target) {
        int low = 0, high = nums.length - 1;
        while (low <= high) {
            int mid = low + (high - low) / 2;
            if (nums[mid] == target) return mid;
            if (nums[mid] < target) low = mid + 1;
            else high = mid - 1;
        }
        return -1;
    }
}`,
      python: `def search(nums: list[int], target: int) -> int:
    low, high = 0, len(nums) - 1
    while low <= high:
        mid = low + (high - low) // 2
        if nums[mid] == target:
            return mid
        if nums[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1`,
      typescript: `function search(nums: number[], target: number): number {
    let low = 0;
    let high = nums.length - 1;
    while (low <= high) {
        const mid = low + Math.floor((high - low) / 2);
        if (nums[mid] === target) return mid;
        if (nums[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}`,
    },
  },
  {
    id: "search-in-rotated-sorted-array",
    number: 33,
    title: "Search in Rotated Sorted Array",
    difficulty: "Medium",
    category: "Binary Search",
    pattern: "Modified Binary Search",
    url: "https://leetcode.com/problems/search-in-rotated-sorted-array/",
    prompt:
      "Given a rotated ascending array of distinct integers, find the index of target in O(log n), or -1 if absent.",
    approach:
      "At each step, one of [lo, mid] or [mid, hi] is guaranteed sorted. Check whether target falls inside that sorted half's range to decide which half to keep searching.",
    complexity: "Time O(log n), Space O(1)",
    solutions: {
      java: `class Solution {
    public int search(int[] nums, int target) {
        int lo = 0, hi = nums.length - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (nums[mid] == target) return mid;
            if (nums[lo] <= nums[mid]) {
                if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
                else lo = mid + 1;
            } else {
                if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
                else hi = mid - 1;
            }
        }
        return -1;
    }
}`,
      python: `def search(nums: list[int], target: int) -> int:
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = lo + (hi - lo) // 2
        if nums[mid] == target:
            return mid
        if nums[lo] <= nums[mid]:
            if nums[lo] <= target < nums[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        else:
            if nums[mid] < target <= nums[hi]:
                lo = mid + 1
            else:
                hi = mid - 1
    return -1`,
      typescript: `function search(nums: number[], target: number): number {
    let lo = 0;
    let hi = nums.length - 1;
    while (lo <= hi) {
        const mid = lo + Math.floor((hi - lo) / 2);
        if (nums[mid] === target) return mid;
        if (nums[lo] <= nums[mid]) {
            if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
            else lo = mid + 1;
        } else {
            if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
            else hi = mid - 1;
        }
    }
    return -1;
}`,
    },
  },

  // ─── Linked List ─────────────────────────────────────────────────────────────
  {
    id: "reverse-linked-list",
    number: 206,
    title: "Reverse Linked List",
    difficulty: "Easy",
    category: "Linked List",
    pattern: "Linked List",
    url: "https://leetcode.com/problems/reverse-linked-list/",
    prompt: "Given the head of a singly linked list, reverse it and return the new head.",
    approach:
      "Walk the list once, rewiring each node's next pointer to its predecessor. Keep three references: prev, current, and the saved next. prev ends on the new head.",
    complexity: "Time O(n), Space O(1)",
    solutions: {
      java: `class Solution {
    public ListNode reverseList(ListNode head) {
        ListNode prev = null;
        while (head != null) {
            ListNode next = head.next;
            head.next = prev;
            prev = head;
            head = next;
        }
        return prev;
    }
}`,
      python: `def reverse_list(head: ListNode | None) -> ListNode | None:
    prev = None
    while head:
        nxt = head.next
        head.next = prev
        prev = head
        head = nxt
    return prev`,
      typescript: `function reverseList(head: ListNode | null): ListNode | null {
    let prev: ListNode | null = null;
    while (head) {
        const next: ListNode | null = head.next;
        head.next = prev;
        prev = head;
        head = next;
    }
    return prev;
}`,
    },
  },
  {
    id: "linked-list-cycle",
    number: 141,
    title: "Linked List Cycle",
    difficulty: "Easy",
    category: "Linked List",
    pattern: "Fast & Slow Pointers",
    url: "https://leetcode.com/problems/linked-list-cycle/",
    prompt: "Given the head of a linked list, determine whether it contains a cycle.",
    approach:
      "Floyd's tortoise and hare: advance slow by one node and fast by two. If a cycle exists they eventually meet; if fast reaches the end first, there is no cycle.",
    complexity: "Time O(n), Space O(1)",
    solutions: {
      java: `class Solution {
    public boolean hasCycle(ListNode head) {
        ListNode slow = head, fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) return true;
        }
        return false;
    }
}`,
      python: `def has_cycle(head: ListNode | None) -> bool:
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return True
    return False`,
      typescript: `function hasCycle(head: ListNode | null): boolean {
    let slow = head;
    let fast = head;
    while (fast && fast.next) {
        slow = slow!.next;
        fast = fast.next.next;
        if (slow === fast) return true;
    }
    return false;
}`,
    },
  },

  // ─── Trees ───────────────────────────────────────────────────────────────────
  {
    id: "invert-binary-tree",
    number: 226,
    title: "Invert Binary Tree",
    difficulty: "Easy",
    category: "Trees",
    pattern: "DFS / Recursion",
    url: "https://leetcode.com/problems/invert-binary-tree/",
    prompt: "Invert a binary tree (mirror it left-to-right) and return its root.",
    approach: "Recursively swap the left and right children of every node.",
    complexity: "Time O(n), Space O(h) recursion stack",
    solutions: {
      java: `class Solution {
    public TreeNode invertTree(TreeNode root) {
        if (root == null) return null;
        TreeNode left = invertTree(root.left);
        TreeNode right = invertTree(root.right);
        root.left = right;
        root.right = left;
        return root;
    }
}`,
      python: `def invert_tree(root: TreeNode | None) -> TreeNode | None:
    if not root:
        return None
    root.left, root.right = invert_tree(root.right), invert_tree(root.left)
    return root`,
      typescript: `function invertTree(root: TreeNode | null): TreeNode | null {
    if (!root) return null;
    const left = invertTree(root.left);
    const right = invertTree(root.right);
    root.left = right;
    root.right = left;
    return root;
}`,
    },
  },
  {
    id: "maximum-depth-of-binary-tree",
    number: 104,
    title: "Maximum Depth of Binary Tree",
    difficulty: "Easy",
    category: "Trees",
    pattern: "DFS / Recursion",
    url: "https://leetcode.com/problems/maximum-depth-of-binary-tree/",
    prompt: "Return the maximum depth (longest root-to-leaf node count) of a binary tree.",
    approach:
      "Recursively return 1 plus the larger of the left and right subtree depths. An empty tree has depth 0.",
    complexity: "Time O(n), Space O(h) recursion stack",
    solutions: {
      java: `class Solution {
    public int maxDepth(TreeNode root) {
        if (root == null) return 0;
        return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
    }
}`,
      python: `def max_depth(root: TreeNode | None) -> int:
    if not root:
        return 0
    return 1 + max(max_depth(root.left), max_depth(root.right))`,
      typescript: `function maxDepth(root: TreeNode | null): number {
    if (!root) return 0;
    return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}`,
    },
  },
  {
    id: "validate-binary-search-tree",
    number: 98,
    title: "Validate Binary Search Tree",
    difficulty: "Medium",
    category: "Trees",
    pattern: "DFS + Range Bounds",
    url: "https://leetcode.com/problems/validate-binary-search-tree/",
    prompt: "Determine whether a binary tree is a valid binary search tree.",
    approach:
      "Recursively carry a valid (low, high) range down to each node. A node's value must sit strictly inside its inherited bounds, and it tightens those bounds for its own children.",
    complexity: "Time O(n), Space O(h) recursion stack",
    solutions: {
      java: `class Solution {
    public boolean isValidBST(TreeNode root) {
        return valid(root, null, null);
    }

    private boolean valid(TreeNode node, Long low, Long high) {
        if (node == null) return true;
        if ((low != null && node.val <= low) || (high != null && node.val >= high)) return false;
        return valid(node.left, low, (long) node.val) && valid(node.right, (long) node.val, high);
    }
}`,
      python: `def is_valid_bst(root: TreeNode | None) -> bool:
    def valid(node: TreeNode | None, low: float, high: float) -> bool:
        if not node:
            return True
        if not (low < node.val < high):
            return False
        return valid(node.left, low, node.val) and valid(node.right, node.val, high)

    return valid(root, float("-inf"), float("inf"))`,
      typescript: `function isValidBST(root: TreeNode | null): boolean {
    function valid(node: TreeNode | null, low: number, high: number): boolean {
        if (!node) return true;
        if (!(node.val > low && node.val < high)) return false;
        return valid(node.left, low, node.val) && valid(node.right, node.val, high);
    }
    return valid(root, -Infinity, Infinity);
}`,
    },
  },

  // ─── Graphs ──────────────────────────────────────────────────────────────────
  {
    id: "number-of-islands",
    number: 200,
    title: "Number of Islands",
    difficulty: "Medium",
    category: "Graphs",
    pattern: "DFS / Flood Fill",
    url: "https://leetcode.com/problems/number-of-islands/",
    prompt:
      "Given a grid of '1' (land) and '0' (water), count the islands. Land cells connect horizontally or vertically.",
    approach:
      "Scan the grid. On each unvisited land cell, run a flood-fill (DFS) that sinks the whole island to '0', then increment the count. Each cell is visited once.",
    complexity: "Time O(rows x cols), Space O(rows x cols) worst-case recursion",
    solutions: {
      java: `class Solution {
    public int numIslands(char[][] grid) {
        int count = 0;
        for (int r = 0; r < grid.length; r++) {
            for (int c = 0; c < grid[0].length; c++) {
                if (grid[r][c] == '1') {
                    sink(grid, r, c);
                    count++;
                }
            }
        }
        return count;
    }

    private void sink(char[][] grid, int r, int c) {
        if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length || grid[r][c] != '1') return;
        grid[r][c] = '0';
        sink(grid, r + 1, c);
        sink(grid, r - 1, c);
        sink(grid, r, c + 1);
        sink(grid, r, c - 1);
    }
}`,
      python: `def num_islands(grid: list[list[str]]) -> int:
    rows, cols = len(grid), len(grid[0])

    def sink(r: int, c: int) -> None:
        if r < 0 or c < 0 or r >= rows or c >= cols or grid[r][c] != "1":
            return
        grid[r][c] = "0"
        sink(r + 1, c)
        sink(r - 1, c)
        sink(r, c + 1)
        sink(r, c - 1)

    count = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "1":
                sink(r, c)
                count += 1
    return count`,
      typescript: `function numIslands(grid: string[][]): number {
    const rows = grid.length;
    const cols = grid[0].length;

    function sink(r: number, c: number): void {
        if (r < 0 || c < 0 || r >= rows || c >= cols || grid[r][c] !== "1") return;
        grid[r][c] = "0";
        sink(r + 1, c);
        sink(r - 1, c);
        sink(r, c + 1);
        sink(r, c - 1);
    }

    let count = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c] === "1") {
                sink(r, c);
                count++;
            }
        }
    }
    return count;
}`,
    },
  },
  {
    id: "course-schedule",
    number: 207,
    title: "Course Schedule",
    difficulty: "Medium",
    category: "Graphs",
    pattern: "Cycle Detection (DFS)",
    url: "https://leetcode.com/problems/course-schedule/",
    prompt:
      "Given numCourses and prerequisite pairs [a, b] (a requires b), determine whether all courses can be completed — i.e. the prerequisite graph has no cycle.",
    approach:
      "Build an adjacency list, then DFS from each node tracking three states per node (unvisited / visiting / done). Hitting a node currently marked 'visiting' means a back-edge, i.e. a cycle.",
    complexity: "Time O(V + E), Space O(V + E)",
    solutions: {
      java: `class Solution {
    public boolean canFinish(int numCourses, int[][] prerequisites) {
        List<List<Integer>> graph = new ArrayList<>();
        for (int i = 0; i < numCourses; i++) graph.add(new ArrayList<>());
        for (int[] p : prerequisites) graph.get(p[0]).add(p[1]);

        int[] state = new int[numCourses]; // 0=unvisited, 1=visiting, 2=done
        for (int i = 0; i < numCourses; i++) {
            if (state[i] == 0 && hasCycle(i, graph, state)) return false;
        }
        return true;
    }

    private boolean hasCycle(int node, List<List<Integer>> graph, int[] state) {
        state[node] = 1;
        for (int next : graph.get(node)) {
            if (state[next] == 1) return true;
            if (state[next] == 0 && hasCycle(next, graph, state)) return true;
        }
        state[node] = 2;
        return false;
    }
}`,
      python: `def can_finish(num_courses: int, prerequisites: list[list[int]]) -> bool:
    graph: list[list[int]] = [[] for _ in range(num_courses)]
    for a, b in prerequisites:
        graph[a].append(b)

    state = [0] * num_courses  # 0=unvisited, 1=visiting, 2=done

    def has_cycle(node: int) -> bool:
        state[node] = 1
        for nxt in graph[node]:
            if state[nxt] == 1:
                return True
            if state[nxt] == 0 and has_cycle(nxt):
                return True
        state[node] = 2
        return False

    return not any(state[i] == 0 and has_cycle(i) for i in range(num_courses))`,
      typescript: `function canFinish(numCourses: number, prerequisites: number[][]): boolean {
    const graph: number[][] = Array.from({ length: numCourses }, () => []);
    for (const [a, b] of prerequisites) graph[a].push(b);

    const state = new Array<number>(numCourses).fill(0); // 0=unvisited, 1=visiting, 2=done

    function hasCycle(node: number): boolean {
        state[node] = 1;
        for (const next of graph[node]) {
            if (state[next] === 1) return true;
            if (state[next] === 0 && hasCycle(next)) return true;
        }
        state[node] = 2;
        return false;
    }

    for (let i = 0; i < numCourses; i++) {
        if (state[i] === 0 && hasCycle(i)) return false;
    }
    return true;
}`,
    },
  },

  // ─── Dynamic Programming ─────────────────────────────────────────────────────
  {
    id: "climbing-stairs",
    number: 70,
    title: "Climbing Stairs",
    difficulty: "Easy",
    category: "Dynamic Programming",
    pattern: "1-D DP (Fibonacci)",
    url: "https://leetcode.com/problems/climbing-stairs/",
    prompt:
      "You can climb 1 or 2 steps at a time. Count the distinct ways to reach the top of an n-step staircase.",
    approach:
      "Ways to reach step n equal ways(n-1) + ways(n-2), the Fibonacci recurrence. Roll two variables forward instead of storing the whole table.",
    complexity: "Time O(n), Space O(1)",
    solutions: {
      java: `class Solution {
    public int climbStairs(int n) {
        int prev = 1, curr = 1;
        for (int i = 2; i <= n; i++) {
            int next = prev + curr;
            prev = curr;
            curr = next;
        }
        return curr;
    }
}`,
      python: `def climb_stairs(n: int) -> int:
    prev, curr = 1, 1
    for _ in range(2, n + 1):
        prev, curr = curr, prev + curr
    return curr`,
      typescript: `function climbStairs(n: number): number {
    let prev = 1;
    let curr = 1;
    for (let i = 2; i <= n; i++) {
        const next = prev + curr;
        prev = curr;
        curr = next;
    }
    return curr;
}`,
    },
  },
  {
    id: "maximum-subarray",
    number: 53,
    title: "Maximum Subarray",
    difficulty: "Medium",
    category: "Dynamic Programming",
    pattern: "Kadane's Algorithm",
    url: "https://leetcode.com/problems/maximum-subarray/",
    prompt:
      "Given an integer array nums, find the contiguous subarray with the largest sum and return that sum.",
    approach:
      "Kadane's algorithm: at each element decide whether to extend the running sum or restart from the current element. Track the best running sum seen.",
    complexity: "Time O(n), Space O(1)",
    solutions: {
      java: `class Solution {
    public int maxSubArray(int[] nums) {
        int current = nums[0], best = nums[0];
        for (int i = 1; i < nums.length; i++) {
            current = Math.max(nums[i], current + nums[i]);
            best = Math.max(best, current);
        }
        return best;
    }
}`,
      python: `def max_sub_array(nums: list[int]) -> int:
    current = best = nums[0]
    for n in nums[1:]:
        current = max(n, current + n)
        best = max(best, current)
    return best`,
      typescript: `function maxSubArray(nums: number[]): number {
    let current = nums[0];
    let best = nums[0];
    for (let i = 1; i < nums.length; i++) {
        current = Math.max(nums[i], current + nums[i]);
        best = Math.max(best, current);
    }
    return best;
}`,
    },
  },
  {
    id: "house-robber",
    number: 198,
    title: "House Robber",
    difficulty: "Medium",
    category: "Dynamic Programming",
    pattern: "1-D DP",
    url: "https://leetcode.com/problems/house-robber/",
    prompt:
      "Given the cash value in a row of houses, return the max total obtainable without ever robbing two adjacent houses.",
    approach:
      "Roll two running values forward: the best total excluding the previous house and the best total including a choice at the previous house. At each house, take the max of skipping it or adding it to the best total two houses back.",
    complexity: "Time O(n), Space O(1)",
    solutions: {
      java: `class Solution {
    public int rob(int[] nums) {
        int prev = 0, curr = 0;
        for (int n : nums) {
            int next = Math.max(curr, prev + n);
            prev = curr;
            curr = next;
        }
        return curr;
    }
}`,
      python: `def rob(nums: list[int]) -> int:
    prev, curr = 0, 0
    for n in nums:
        prev, curr = curr, max(curr, prev + n)
    return curr`,
      typescript: `function rob(nums: number[]): number {
    let prev = 0;
    let curr = 0;
    for (const n of nums) {
        const next = Math.max(curr, prev + n);
        prev = curr;
        curr = next;
    }
    return curr;
}`,
    },
  },
  {
    id: "coin-change",
    number: 322,
    title: "Coin Change",
    difficulty: "Medium",
    category: "Dynamic Programming",
    pattern: "1-D DP (Unbounded Knapsack)",
    url: "https://leetcode.com/problems/coin-change/",
    prompt:
      "Given coin denominations and a target amount, return the fewest coins needed to make that amount, or -1 if it cannot be made.",
    approach:
      "Bottom-up DP where dp[a] is the minimum coins for amount a. dp[0] = 0, and every amount is built from the best of dp[a - coin] + 1 across all coin denominations.",
    complexity: "Time O(amount * coins), Space O(amount)",
    solutions: {
      java: `class Solution {
    public int coinChange(int[] coins, int amount) {
        int[] dp = new int[amount + 1];
        Arrays.fill(dp, amount + 1);
        dp[0] = 0;
        for (int a = 1; a <= amount; a++) {
            for (int coin : coins) {
                if (coin <= a) dp[a] = Math.min(dp[a], dp[a - coin] + 1);
            }
        }
        return dp[amount] > amount ? -1 : dp[amount];
    }
}`,
      python: `def coin_change(coins: list[int], amount: int) -> int:
    dp = [amount + 1] * (amount + 1)
    dp[0] = 0
    for a in range(1, amount + 1):
        for coin in coins:
            if coin <= a:
                dp[a] = min(dp[a], dp[a - coin] + 1)
    return dp[amount] if dp[amount] <= amount else -1`,
      typescript: `function coinChange(coins: number[], amount: number): number {
    const dp = new Array<number>(amount + 1).fill(amount + 1);
    dp[0] = 0;
    for (let a = 1; a <= amount; a++) {
        for (const coin of coins) {
            if (coin <= a) dp[a] = Math.min(dp[a], dp[a - coin] + 1);
        }
    }
    return dp[amount] > amount ? -1 : dp[amount];
}`,
    },
  },

  // ─── Intervals ───────────────────────────────────────────────────────────────
  {
    id: "merge-intervals",
    number: 56,
    title: "Merge Intervals",
    difficulty: "Medium",
    category: "Intervals",
    pattern: "Sort + Sweep",
    url: "https://leetcode.com/problems/merge-intervals/",
    prompt: "Given a collection of intervals, merge all overlapping ones and return the result.",
    approach:
      "Sort by start value. Walk through in order, extending the last merged interval's end whenever the next interval overlaps it, otherwise starting a new merged interval.",
    complexity: "Time O(n log n), Space O(n)",
    solutions: {
      java: `class Solution {
    public int[][] merge(int[][] intervals) {
        Arrays.sort(intervals, (a, b) -> a[0] - b[0]);
        List<int[]> merged = new ArrayList<>();
        for (int[] interval : intervals) {
            if (merged.isEmpty() || merged.get(merged.size() - 1)[1] < interval[0]) {
                merged.add(interval);
            } else {
                merged.get(merged.size() - 1)[1] = Math.max(merged.get(merged.size() - 1)[1], interval[1]);
            }
        }
        return merged.toArray(new int[0][]);
    }
}`,
      python: `def merge(intervals: list[list[int]]) -> list[list[int]]:
    intervals.sort(key=lambda i: i[0])
    merged: list[list[int]] = []
    for interval in intervals:
        if not merged or merged[-1][1] < interval[0]:
            merged.append(interval)
        else:
            merged[-1][1] = max(merged[-1][1], interval[1])
    return merged`,
      typescript: `function merge(intervals: number[][]): number[][] {
    intervals.sort((a, b) => a[0] - b[0]);
    const merged: number[][] = [];
    for (const interval of intervals) {
        const last = merged[merged.length - 1];
        if (!last || last[1] < interval[0]) {
            merged.push(interval);
        } else {
            last[1] = Math.max(last[1], interval[1]);
        }
    }
    return merged;
}`,
    },
  },

  // ─── Greedy ──────────────────────────────────────────────────────────────────
  {
    id: "jump-game",
    number: 55,
    title: "Jump Game",
    difficulty: "Medium",
    category: "Greedy",
    pattern: "Greedy",
    url: "https://leetcode.com/problems/jump-game/",
    prompt:
      "Given the max jump length from each index, determine whether you can reach the last index starting from index 0.",
    approach:
      "Greedily track the furthest index reachable so far while scanning left to right. If the current index ever exceeds that reach, the end is unreachable.",
    complexity: "Time O(n), Space O(1)",
    solutions: {
      java: `class Solution {
    public boolean canJump(int[] nums) {
        int reach = 0;
        for (int i = 0; i < nums.length; i++) {
            if (i > reach) return false;
            reach = Math.max(reach, i + nums[i]);
        }
        return true;
    }
}`,
      python: `def can_jump(nums: list[int]) -> bool:
    reach = 0
    for i, n in enumerate(nums):
        if i > reach:
            return False
        reach = max(reach, i + n)
    return True`,
      typescript: `function canJump(nums: number[]): boolean {
    let reach = 0;
    for (let i = 0; i < nums.length; i++) {
        if (i > reach) return false;
        reach = Math.max(reach, i + nums[i]);
    }
    return true;
}`,
    },
  },

  // ─── Bit Manipulation ────────────────────────────────────────────────────────
  {
    id: "single-number",
    number: 136,
    title: "Single Number",
    difficulty: "Easy",
    category: "Bit Manipulation",
    pattern: "XOR",
    url: "https://leetcode.com/problems/single-number/",
    prompt:
      "Every element in nums appears twice except for one. Find that single element in linear time and constant space.",
    approach:
      "XOR every number together. Identical values XOR to zero and cancel out, leaving only the value that appears once.",
    complexity: "Time O(n), Space O(1)",
    solutions: {
      java: `class Solution {
    public int singleNumber(int[] nums) {
        int result = 0;
        for (int n : nums) result ^= n;
        return result;
    }
}`,
      python: `from functools import reduce
import operator

def single_number(nums: list[int]) -> int:
    return reduce(operator.xor, nums, 0)`,
      typescript: `function singleNumber(nums: number[]): number {
    return nums.reduce((acc, n) => acc ^ n, 0);
}`,
    },
  },
];
