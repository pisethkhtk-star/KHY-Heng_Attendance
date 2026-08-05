import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/localization/app_translations.dart';

class LanguageProvider extends ChangeNotifier {
  String _currentLanguage = 'km'; // Default to Khmer

  String get currentLanguage => _currentLanguage;

  LanguageProvider() {
    _loadLanguagePreference();
  }

  Future<void> _loadLanguagePreference() async {
    final prefs = await SharedPreferences.getInstance();
    _currentLanguage = prefs.getString('app_language') ?? 'km';
    notifyListeners();
  }

  Future<void> setLanguage(String langCode) async {
    if (_currentLanguage != langCode) {
      _currentLanguage = langCode;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('app_language', langCode);
      notifyListeners();
    }
  }

  String tr(String key) {
    return AppTranslations.getText(_currentLanguage, key);
  }
}
