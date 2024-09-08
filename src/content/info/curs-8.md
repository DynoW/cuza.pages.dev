---
title: "Curs-8"
description: "Transformări"
---

a) din baza 10 in baza 2

69 (baza 10) = ? (baza 2)

```cpp
int n = 69;

int nrb = 0;
int p = 1;
while(n != 0) {
    nrb = nrb + p * (n % 2);
    n = n / 2;
    p = p * 10;
}

output=>1000101
```

b) din baza 2 in baza 10

ex: 1000101 (baza 2) = ? (baza 10)

```cpp
int n = 1000101;

int nrb = 0;
int p = 1;
while(n != 0) {
    nrb = nrb + p * (n % 10);
    n = n / 10;
    p = p * 2;
}

output=>69
```

c) din baza a in baza b

ex: 123 (baza a) = ? (baza b)

```cpp
int n = 123; // Număr în baza a
int a = 10; // Baza numărului
int b = 2; // Baza dorita

int nrb = 0;
int p = 1;
while(n != 0) {
    nrb = nrb + p * (n % b);
    n = n / b;
    p = p * a;
}

output=>1111011
```