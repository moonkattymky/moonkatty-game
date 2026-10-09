// Isolated arithmetic cross-check, not browser layout or a production module.
#include <cmath>
#include <cstdint>
#include <cstring>
#include <iostream>
int main() {
  double basis, percentage;
  while (std::cin >> basis >> percentage) {
    volatile float b = static_cast<float>(basis);
    volatile float p = static_cast<float>(percentage);
    volatile float multiplied = b * p;
    volatile float result = multiplied / 100.0f;
    const float value = result;
    uint32_t bits; std::memcpy(&bits, &value, sizeof(bits));
    std::cout << bits << ' ' << static_cast<int64_t>(std::trunc(static_cast<double>(value) * 64)) << '\n';
  }
}
