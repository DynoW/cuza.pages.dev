---
title: "Curs-8"
description: "Transformări"
---

## a) Din baza 10 în baza 2

Exemplu: `69` (baza 10) = `1000101` (baza 2)

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

## b) Din baza 2 în baza 10

Exemplu: `1000101` (baza 2) = `69` (baza 10)

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

## c) Din baza `a` în baza `b`

Exemplu: `123` (baza 4) = `11011` (baza 2)

Metoda standard: întâi transformi în baza 10, apoi din baza 10 în baza `b`.

```cpp
int n = 123; // număr scris cu cifre 0..9, în baza a
int a = 4;
int b = 2;

int zecimal = 0;
int p = 1;
while(n != 0) {
    zecimal = zecimal + (n % 10) * p;
    n = n / 10;
    p = p * a;
}

int nrb = 0;
p = 1;
while(zecimal != 0) {
    nrb = nrb + p * (zecimal % b);
    zecimal = zecimal / b;
    p = p * 10;
}

output=>11011
```